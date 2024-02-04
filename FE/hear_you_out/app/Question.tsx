
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import Modal from "react-native-modal";
import Mic from './Mic.png';
import Checklist from './Checklist'
import BottomButtons from './BottomButtons'
import AudioRecorderPlayer, { AudioEncoderAndroidType, AVEncodingOption } from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs'
import { RNFFmpeg } from 'react-native-ffmpeg';
import { APIAnswerStats, APIQuestion } from "./Network"
import { resizePlayPause, SizeContext } from './helpers'
import { resizeAudioCircle, resizeMic, resizeTitle, animateCircle } from './helpers'
import ShakeElement from './ShakeElement';
import FadeInElement from './FadeInElement'
import ModalContents from './ModalContents'
import Pause from './Pause.png';
import { PointerArrow } from "./PointerArrow"
import analytics from '@react-native-firebase/analytics';

// https://github.com/hyochan/react-native-audio-recorder-player/blob/master/index.ts
const audioSet = {
  AudioEncoderAndroid: AudioEncoderAndroidType.HE_AAC, // AAC is slightly better quality but like 75% increase in size
  AudioEncodingBitRateAndroid: 102400, // increase to 128000 if we get more storage
  AudioSamplingRateAndroid: 48000,
  AVFormatIDKeyIOS: AVEncodingOption.aac, // 7% size of alac
  AVSampleRateKeyIOS: 22050, // half the default, half the size
  AVNumberOfChannelsKeyIOS: 1, // half the default, 2/3 the size
}

type QuestionProps = {
  // contains the text of the question to answer as well as the type which informs our checklist content
  question: APIQuestion,
  submitAnswerAndProceed: (data:string) => void,
  // whether they completed tutorial or not
  completedTutorial: boolean,
  // tell the parent we completed the tutorial, which will update the above value
  onCompleteTutorial: () => void
  // an un-recoverable error has occured and we need to reload the app
  onError: () => void
  stats: APIAnswerStats,
  isShown: boolean
}

const Question = ({ submitAnswerAndProceed, question, stats, isShown, completedTutorial, onCompleteTutorial, onError }: QuestionProps) => {
  const screenSize = React.useContext(SizeContext)
  const checklist = React.useRef()
  const recorderShaker = React.useRef()
  const [circles, setCircles] = React.useState({})
  const [currentTutorialElement, setCurrentTutorialElement] = React.useState("")
  // TODO set disabled styles on everything when submitting?
  const [submitting, setSubmitting] = React.useState(false)
  const hasStats = stats?.views_count

  // modal
  const [modalVisible, setModalVisible] = React.useState(false)
  const [modalText, setModalText] = React.useState("")
  const [modalConfirm, setModalConfirm] = React.useState<Function | null>(null)
  const [shookChecklist, setShookChecklist] = React.useState(false)
  const [shookRecorder, setShookRecorder] = React.useState(false)

  // timer
  const [recordTime, setRecordTime] = React.useState(0)
  const timingRecord = React.useRef(false)
  const intervalRecord = React.useRef(null)
  const intervalPlayback = React.useRef(null)
  // we call animateCircle from a scope that doesnt have access to recordTime, so we box the state here for it and update it each render
  const recordTimeForCircles = React.useRef(0)
  recordTimeForCircles.current = recordTime

  // recorder/player
  const recorder = React.useRef(new AudioRecorderPlayer()).current
  const [ready, setReady] = React.useState(false)
  // maintain a lock for the recorder so we only execute 1 function at time
  const lock = React.useRef(false)
  // whether we started a recording
  const [started, setStarted] = React.useState(false)
  // whether we are currently recording
  const [recording, setRecording] = React.useState(false)
  // whether we are playing back what we've recorded so far
  const [playing, setPlaying] = React.useState(false)
  const [playTime, setPlayTime] = React.useState(0)
  // each time we playback, we need to stop our recording, playback, and then start a new one when the user continues recording (we're not allowed to playback while paused)
  const needsNewFile = React.useRef(false)
  // if we stop a recording that isnt the original file, concat it with the original file 
  const needsConcat = React.useRef(false)
  const extention = Platform.OS === 'android' ? ".mp4" : ".m4a"
  const prepend = Platform.OS === 'android' ? "" : "file://"
  const originalFile = prepend + RNFS.CachesDirectoryPath + '/' + "HearYouOutRecordOriginal" + extention
  const additionalFile = prepend + RNFS.CachesDirectoryPath + '/' + "HearYouOutRecordAdditional" + extention
  const concatFile = prepend + RNFS.CachesDirectoryPath + '/' + "HearYouOutRecordConcated" + extention
  const fileList = prepend + RNFS.CachesDirectoryPath + '/' + "fileList.txt"

  // run this effect ONCE when this component mounts
  React.useEffect(() => {
    analytics().logEvent('question_screen');
    const asyncFun = async () => {
      // our timer is constantly running, we just turn it off and on based on recording
      intervalRecord.current = setInterval(() => {
        if (timingRecord.current) {
          setRecordTime((prevTime) => {
            if (prevTime >= 300) {
              recordPaused(true)
              setModalVisible(true)
              setModalText("You have reached the max recording time")
              setModalConfirm(null)
            }
            return prevTime + 1
          })
        }
      }, 1000)

      // add a playback listener for recording animations
      recorder.setSubscriptionDuration(0.2)
      recorder.addRecordBackListener(({ currentMetering }) => {
        // TODO test this level on other devices
        const minMeter = Platform.OS === "android" ? -20 : -23
        if (currentMetering > minMeter) animateCircle("question", setCircles, screenSize, recordTimeForCircles)
      })
      // we make a text file with our audio file paths listed for later concatenation
      const paths = [originalFile, additionalFile]
      var listContent = ''
      paths.forEach(path => {
        listContent += `file '${path}'\n`
      });
      try {
        await RNFS.writeFile(fileList, listContent, 'utf8')
        setReady(true)
      } catch (e) {
        analytics().logEvent('ERROR_question_mount', {details: 'Cannot write file in initial question setup', error: e.message});
        console.log(e)
        // if we can't even write our filelist, something's seriously wrong. 
        Alert.alert("Cannot write files. Please contact support if this keeps happening.")
        onError()
      }
    }
    // call all the above + cleanup later
    asyncFun()
    return () => {
      const asyncFunRet = async () => {
        clearInterval(intervalRecord.current)
        try {
          recorder.removeRecordBackListener()
          await stopRecorderAndConcat()
          await deleteCurrentFile()
        }
        catch (e) {
          analytics().logEvent('ERROR_question_unmount', {details: 'Failed to stop/unlink question on unmount', error: e.message});
          console.log("failed to stop/unlink question on unmount")
          console.log(e)
          // we're unmounting, don't bother handling error
        }
      }
      asyncFunRet()
    }
  }, [])

  // when the question is first shown, if the user's answer to the previous question has stats, show them to the user
  React.useEffect(() => {
    if (hasStats && isShown) {
      setModalVisible(true)
      setModalText(stats.views_count + " people heard your last answer!")
    }
  }, [hasStats, isShown])

  const recordPressed = () => {
    if (recording) recordPaused()
    else recordStartContinue()
  }

  const recordStartContinue = async () => {
    if (lock.current || recording) return
    if (recordTime >= 300) {
      setModalVisible(true)
      setModalText("You have reached the max recording time")
      setModalConfirm(null)
      return
    }
    analytics().logEvent('question_recording_started_or_continued');
    lock.current = true
    try {
      // stop playing
      if (playing) {
        stopPlaying()
      }
      // set recording & start timer
      setRecording(true)
      timingRecord.current = true
      // we've started already
      if (started) {
        // we've played back and need to start a new file to concat
        if (needsNewFile.current) {
          needsNewFile.current = false
          needsConcat.current = true
          await recorder.startRecorder(additionalFile, audioSet, true)
        }
        // we can simply unpause
        else {
          await recorder.resumeRecorder()
        }
      }
      // we havent started, create the original file and start
      else {
        setStarted(true)
        await recorder.startRecorder(originalFile, audioSet, true)
      }
    }
    catch (e) {
      analytics().logEvent('ERROR_recordStartContinue', {details: 'Recording failed', error: e.message});
      // Writing files or accessing the recorder must have failed, but I don't know why. Reset everything
      Alert.alert("Recording failed. Please contact support if this keeps happening.")
      console.log(e)
      onError()
    }
    lock.current = false
  }

  // we use force when we can't rely on `recording` due to the setInterval timer not having updated variables
  const recordPaused = async (force:boolean = false, retry:boolean = false) => {
    if (lock.current) return
    analytics().logEvent('question_recording_paused', { seconds: recordTime });
    lock.current = true
    try { 
      if (recording || force) {
        // this is due to a bug with recorder that thinks the new file is already paused (and therefore cannot be paused), when its not
        await recorder.resumeRecorder()
        await recorder.pauseRecorder()
        setRecording(false)
        timingRecord.current = false
      }
      lock.current = false
    }
    catch (e) {
      // Pausing failed. Re-attempt without forcing. If we wind up here again, error out.
      if (retry) {
        analytics().logEvent('ERROR_recordPaused', {details: 'Pausing failed', error: e.message});
        Alert.alert("Pausing failed. Please contact support if this keeps happening.")
        console.log(e)
        onError()
      }
      else {
        lock.current = false
        setTimeout(() => recordPaused(false, true), 100)
      }
    }
  }

  const informBeginRecording = async () => {
    if (lock.current) return
    if (!shookRecorder) {
      recorderShaker?.current?.shake()
      setShookRecorder(true)
    }
    else {
      setModalText("You need to start a recording first!")
      setModalConfirm(null)
      setModalVisible(true)
      setShookRecorder(false)
    }
  }

  const restartRecording = async () => {
    if (lock.current) return
    if (recording) {
      recorderShaker?.current?.shake()
      return;
    }
    // user pressed first button, now they need to confirm
    setModalText("Delete recording and restart?")
    setModalConfirm(() => restartRecordingConfirmed)
    setModalVisible(true)
  }

  const restartRecordingConfirmed = async () => {
    if (lock.current || recording) return
    analytics().logEvent('question_recording_restarted', { seconds: recordTime });
    lock.current = true
    try {
      if (playing) {
        await stopPlaying()
      }
      setStarted(false)
      setRecordTime(0)
      await stopRecorderAndConcat()
      await deleteCurrentFile()
      checklist?.current?.uncheckAll()
      setModalVisible(false)
    }
    catch (e) {
      analytics().logEvent('ERROR_restartRecordingConfirmed', {details: 'Restarting failed', error: e.message});
      // Similar to recording failed, we dont know what went wrong but it's pretty serious and un-recoverable
      Alert.alert("Restarting failed. Please contact support if this keeps happening.")
      console.log(e)
      onError()
    }
    lock.current = false
  }

  const submitRecording = async () => {
    console.log("PRESSED SUBMIT BUTTON")
    if (lock.current) return
    if (recording) {
      recorderShaker?.current?.shake()
      return;
    }
    // validate checklist
    if (!checklist?.current?.areAllChecked()) {
      if (!shookChecklist) {
        checklist?.current?.shake()
        setShookChecklist(true)
      }
      else {
        analytics().logEvent('tried_submit_recording_without_checks');
        setModalText("Please address all points in the checklist (scroll if you have to)")
        setModalConfirm(null)
        setModalVisible(true)
        setShookChecklist(false)
      }
      return
    }
    if (recordTime < 15) {
      analytics().logEvent('tried_submit_recording_too_short', { seconds: recordTime });
      setModalText("Please thoroughly answer the prompt; your answer was too short")
      setModalConfirm(null)
      setModalVisible(true)
      return
    }
    // user pressed first button, now they need to confirm
    setModalText("Submit your answer?")
    setModalConfirm(() => submitRecordingConfirmed)
    setModalVisible(true)
  }

  const submitRecordingConfirmed = async () => {
    console.log("PRESSED MODAL CONFIRM")
    if (lock.current || recording) return
    lock.current = true
    try {
      setSubmitting(true)
      if (playing) {
        await stopPlaying()
      }
      await stopRecorderAndConcat()
      setModalVisible(false)
      // convert file to base64 to pass it to the backend
      await submitAnswerAndProceed(await RNFS.readFile(originalFile, 'base64'))
      // we dont even care about cleaning up the states because we're gonna move on from this screen
    }
    catch (e) {
      analytics().logEvent('ERROR_submitRecordingConfirmed', {details: 'Submitting failed', error: e.message});
      // they'll be able to re-answer the question since this wasn't a network error
      Alert.alert("Error during submission. Please contact support if this keeps happening.")
      console.log(e)
      onError()
    }
  }

  const hearRecording = async () => {
    if (lock.current) return
    if (recording) {
      recorderShaker?.current?.shake()
      return;
    }
    analytics().logEvent('question_playback', { seconds: recordTime });
    lock.current = true
    try {
      if (playing) {
        await stopPlaying()
      }
      else {
        setPlaying(true)
        needsNewFile.current = true
        await stopRecorderAndConcat()
        await recorder.startPlayer(originalFile)
        intervalPlayback.current = setInterval(() => {
          setPlayTime((prevTime) => {
            if (prevTime >= recordTime) {
              stopPlaying()
              return 0
            }
            return prevTime + 1
          })
        }, 1000)
      }
    }
    catch (e) {
      analytics().logEvent('ERROR_hearRecording', {details: 'Playback failed', error: e.message});
      // Don't throw the user out for this. They can still record, restart, and submit possibly
      Alert.alert("Error during playback. Please contact support if this keeps happening.")
      console.log(e)

    }
    lock.current = false
  }

  const stopPlaying = async () => {
    setPlayTime(0);
    setPlaying(false)
    if (intervalPlayback.current) clearInterval(intervalPlayback.current)
    intervalPlayback.current = null
    await recorder.stopPlayer()
  }

  // this may throw an error, handle it
  const deleteCurrentFile = async () => {
    await RNFS.unlink(originalFile)
  }
  
  // https://www.npmjs.com/package/react-native-ffmpeg
  // see 2.3.2 iOS to see about enabling audio package on iOS
  // concat original file + additional file => original file
  // this may throw an error
  const stopRecorderAndConcat = async () => {
    await recorder.stopRecorder()
    if (needsConcat.current) {
      // concat
      await RNFFmpeg.execute(`-f concat -safe 0 -i ${fileList} -c copy ${concatFile}`)
      // delete old files and rename the new one appropriately
      await RNFS.unlink(originalFile)
      await RNFS.unlink(additionalFile)
      await RNFS.moveFile(concatFile, originalFile)
      needsConcat.current = false
    }
  }

  React.useEffect(() => {
    // dumb way of progressing through tutorial, but a good place to start
    // TODO make more interactive
    if (!completedTutorial) {
      analytics().logEvent('question_tutorial_began');
      let waitTime = 1000
      setTimeout(() => setCurrentTutorialElement('question'), waitTime) // 1 second to load screen
      waitTime += 3500
      setTimeout(() => setCurrentTutorialElement('checklist'), waitTime) // 3 seconds to read the question
      waitTime += 4500
      setTimeout(() => setCurrentTutorialElement('record'), waitTime) // 4 seconds to read checklist
      waitTime += 16500
      setTimeout(() => setCurrentTutorialElement('bottom'), waitTime) // 16 seconds to press button and answer
      waitTime += 750
      setTimeout(onCompleteTutorial, waitTime) // make sure bottom buttons are fully faded in before marking tutorial complete
      setTimeout(() => analytics().logEvent('question_tutorial_completed'), waitTime)
    }
  }, [])

  const getConvertedTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = timeInSeconds % 60
    const needsLeadingZero = seconds < 10
    return `${minutes}:${needsLeadingZero ? '0' : ''}${seconds}`
  }

  if (!ready) return (
    <View style={styles.container} />
  )

return (
    <View style={styles.container}>
      <Modal
        isVisible={modalVisible}
        onBackdropPress={() => setModalVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        useNativeDriver={true}
      >
        <ModalContents
          type={"generic"}
          text={modalText}
          closeModal={() => setModalVisible(false)}
          genericModalConfirmCallback={modalConfirm}
        />
      </Modal>
      
      <FadeInElement
        shouldFadeIn={currentTutorialElement === "question"}
        isVisibleWithoutAnimation={completedTutorial}
      >
        <Text style={[styles.header, resizeTitle(screenSize)]}>
          { question.text }
        </Text>
      </FadeInElement>
      
      <FadeInElement
        shouldFadeIn={currentTutorialElement === "record"}
        isVisibleWithoutAnimation={completedTutorial}
      >
        <ShakeElement ref={recorderShaker}>
          <View style={{ marginTop: 30 }}>
            <PointerArrow
              beginAnimation={currentTutorialElement === "record"}
              beganAction={recording}
              hidePermanantly={completedTutorial}
            />
            {Object.values(circles)}
            <TouchableOpacity
              style={[styles.audioCircle, resizeAudioCircle(screenSize), started ? (recording ? styles.redCircle : styles.whiteCircle/*yellowCircle*/) : styles.whiteCircle]}
              onPress={recordPressed}
              activeOpacity={1}
            >
              <Image
                source={recording ? Pause : Mic}
                style={{ width: recording ? resizePlayPause(screenSize) : resizeMic(screenSize) }}
                resizeMode={'contain'}
              />
            </TouchableOpacity>
          </View>
        </ShakeElement>

        <Text style={[styles.timer, recordTime < 240 ? {} : styles.timerWarning]}>
          { getConvertedTime(recordTime) }
        </Text>
      </FadeInElement>
      
      <View style={styles.checkListContainer}>
        <Checklist
          list={question.checklist}
          ref={checklist}
          disabledPress={started ? undefined : informBeginRecording}
          shouldFadeInText={currentTutorialElement === "checklist"}
          shouldFadeInBoxes={currentTutorialElement === "bottom"}
          isVisibleWithoutAnimation={completedTutorial}
        />
      </View>

      <FadeInElement
        shouldFadeIn={currentTutorialElement === "bottom"}
        isVisibleWithoutAnimation={completedTutorial}
        style={{width: "100%"}}
      >
        <BottomButtons
          theme={"question"}
          xPressed={started ? restartRecording : informBeginRecording}
          checkPressed={started ? submitRecording : informBeginRecording}
          miscPressed={started ? hearRecording : informBeginRecording}
          submitting={submitting}
          miscComponent={ !playing ? null : (
            <Text style={styles.playbackTime}>
              { getConvertedTime(playTime) }
            </Text>
          )}
        />
      </FadeInElement>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    // TODO certain devices may need more padding if SafetyArea doesnt account for top bar
    paddingTop: Platform.OS === "ios" ? 30 : 20,
    alignItems: 'center',
    backgroundColor: "#191919"
  },

  header: {
    textAlign: 'center',
    color: '#F0F3F5'
  },

  timer: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    color: "#C0C3C5"
  },

  playbackTime: {
    fontSize: 18,
    textAlign: 'center',
    color: "#FFF689"
  },

  timerWarning: {
    color: "#BB6153"
  },

  audioCircle: {
    borderRadius:999,
    alignItems: 'center',
    justifyContent: 'center'
  },

  whiteCircle: {
    backgroundColor: '#F0F3F5',
  },

  redCircle: {
    backgroundColor: '#AA5042',
  },

  yellowCircle: {
    borderColor: '#FFF689',
    backgroundColor: '#191919',
    borderWidth: 3,
  },

  checkListContainer: {
    flex: 1,
    width: "100%",
    paddingLeft: 10,
    paddingBottom: 10,
  },
});

export default Question;
