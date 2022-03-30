
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import Modal from "react-native-modal";
// https://github.com/react-native-linear-gradient/react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';
import Mic from './Mic.png';
import Shadow from './Shadow'
import Checklist from './Checklist'
import BottomButtons from './BottomButtons'
import AudioRecorderPlayer, { AudioEncoderAndroidType, AVEncodingOption } from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs'
import { RNFFmpeg } from 'react-native-ffmpeg';
import uuid from 'react-native-uuid';
import { APIQuestion } from "./Network"
import TutorialElement from './TutorialElement'
import { SizeContext } from './helpers'
import { getAudioCircleSize, resizeAudioCircle, resizeMic, resizeTitle } from './helpers'
import ShakeElement from './ShakeElement';


// for tutorial maybe
// https://reactnativeelements.com/docs/tooltip/

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
}

const Question = ({ submitAnswerAndProceed, question, completedTutorial, onCompleteTutorial, onError }: QuestionProps) => {
  const screenSize = React.useContext(SizeContext)
  const checklist = React.useRef()
  const recorderShaker = React.useRef()
  const [circles, setCircles] = React.useState({})
  const [currentTutorialElement, setCurrentTutorialElement] = React.useState("question")
  const [isInTutorial, setIsInTutorial] = React.useState(!completedTutorial)
  // TODO set disabled styles on everything when submitting?
  const [submitting, setSubmitting] = React.useState(false)

  // modal
  const [modalVisible, setModalVisible] = React.useState(false)
  const [modalText, setModalText] = React.useState("")
  const [modalConfirm, setModalConfirm] = React.useState(null)
  const [shookChecklist, setShookChecklist] = React.useState(false)
  const [shookRecorder, setShookRecorder] = React.useState(false)

  // timer
  const [recordTime, setRecordTime] = React.useState(0)
  const timing = React.useRef(false)
  const interval = React.useRef(null)

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
    const asyncFun = async () => {
      // our timer is constantly running, we just turn it off and on based on recording/timing
      interval.current = setInterval(() => {
        if (timing.current) {
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
        if (currentMetering > minMeter) animateCircle()
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
      } catch (error) {
        // if we can't even write our filelist, something's seriously wrong. 
        Alert.alert("Cannot write files. Please contact support if this keeps happening.")
        onError()
      }
    }
    // call all the above + cleanup later
    asyncFun()
    return () => {
      const asyncFunRet = async () => {
        clearInterval(interval.current)
        try {
          recorder.removeRecordBackListener()
          await stopRecorderAndConcat()
          await deleteCurrentFile()
        }
        catch (e) {
          console.log("failed to stop/unlink question on unmount")
          // we're unmounting, don't bother handling error
        }
      }
      asyncFunRet()
    }
  }, [])

  // we call animateCircle from a scope that doesnt have access to recordTime, so we box the state here for it and update it each render
  const recordTimeForCircles = React.useRef(0)
  recordTimeForCircles.current = recordTime
  // while the user is recording, we make a cute animation behind the record button
  // create a circle that will fade out from the center in a random directon
  const animateCircle = () => {
    // get an up-to-date mutable copy of the state so we set it right
    setCircles((lastState) => {
      const circlesCopy = {...lastState}
      // id of our animation
      const id: any = uuid.v4()
      // the animated value we'll use to drive our animation
      const anim = new Animated.Value(0)
      // a random degree from 0 to 360 in radians
      const rotation = Math.random() * 360 * Math.PI / 180
      // add the circle with all its values to our list of animations
      circlesCopy[id] = 
      (<Animated.View 
        key={id}
        style={[{
          // time limit changes color of circles to be darker
          backgroundColor: recordTimeForCircles.current < 240 ? "#ff617c" : '#880000',
          borderRadius: 999,
          position: "absolute",
          elevation: -1,
          zIndex: -1,
          opacity: Animated.subtract(new Animated.Value(1), anim),
          transform: [
            // polar coordinate using our random rotation where distance goes from 0 to 100
            {translateY: Animated.multiply(Animated.multiply(anim, new Animated.Value(200)), new Animated.Value(Math.sin(rotation)))},
            {translateX: Animated.multiply(Animated.multiply(anim, new Animated.Value(200)), new Animated.Value(Math.cos(rotation)))}
          ]
        },
        resizeAudioCircle(screenSize)]}
      />)
      // kick off the animation
      Animated.timing(anim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true
      }).start(() => {
        // remove animation from our list after animation finishes
        // get a new copy 
        setCircles((lastState2) => {
          const circlesCopy2 = {...lastState2}
          circlesCopy2[id] = null
          return circlesCopy2
        })
      })
      // finish setting state
      return circlesCopy
    })
  }

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
    lock.current = true
    try {
      // stop playing
      if (playing) {
        await recorder.stopPlayer()
        setPlaying(false)
      }
      // set recording & start timer
      setRecording(true)
      timing.current = true
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
      // Writing files or accessing the recorder must have failed, but I don't know why. Reset everything
      Alert.alert("Recording failed. Please contact support if this keeps happening.")
      onError()
    }
    lock.current = false
  }

  // we use force when we can't rely on `recording` due to the setInterval timer not having updated variables
  const recordPaused = async (force:boolean = false, retry:boolean = false) => {
    if (lock.current) return
    lock.current = true
    try { 
      if (recording || force) {
        setRecording(false)
        timing.current = false
        await recorder.pauseRecorder()
      }
      lock.current = false
    }
    catch (e) {
      // Pausing failed. Re-attempt without forcing. If we wind up here again, error out.
      if (retry) {
        Alert.alert("Pausing failed. Please contact support if this keeps happening.")
        onError()
      }
      else {
        lock.current = false
        recordPaused(false, true)
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
    if (lock.current || recording) return
    // user pressed first button, now they need to confirm
    setModalText("Delete recording and restart?")
    setModalConfirm(() => restartRecordingConfirmed)
    setModalVisible(true)
  }

  const restartRecordingConfirmed = async () => {
    if (lock.current || recording) return
    lock.current = true
    try {
      if (playing) {
        await recorder.stopPlayer()
        setPlaying(false)
      }
      setStarted(false)
      setRecordTime(0)
      await stopRecorderAndConcat()
      await deleteCurrentFile()
      setModalVisible(false)
    }
    catch (e) {
      // Similar to recording failed, we dont know what went wrong but it's pretty serious and un-recoverable
      Alert.alert("Restarting failed. Please contact support if this keeps happening.")
      onError()
    }
    lock.current = false
  }

  const submitRecording = async () => {
    if (lock.current || recording) return
    // validate checklist
    if (!checklist?.current?.areAllChecked()) {
      if (!shookChecklist) {
        checklist?.current?.shake()
        setShookChecklist(true)
      }
      else {
        setModalText("Please address all points in the checklist (scroll if you have to)")
        setModalConfirm(null)
        setModalVisible(true)
        setShookChecklist(false)
      }
      return
    }
    if (recordTime < 15) {
      setModalText("Please thoroughly answer the prompt (your answer was too short).")
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
    if (lock.current || recording) return
    lock.current = true
    try {
      setSubmitting(true)
      if (playing) {
        await recorder.stopPlayer()
        setPlaying(false)
      }
      await stopRecorderAndConcat()
      setModalVisible(false)
      // convert file to base64 to pass it to the backend
      await submitAnswerAndProceed(await RNFS.readFile(originalFile, 'base64'))
      // we dont even care about cleaning up the states because we're gonna move on from this screen
    }
    catch (e) {
      // they'll be able to re-answer the question since this wasn't a network error
      Alert.alert("Error during submission. Please contact support if this keeps happening.")
      onError()
    }
  }

  const hearRecording = async () => {
    if (lock.current || recording) return
    lock.current = true
    try {
      if (playing) {
        await recorder.stopPlayer()
      }
      setPlaying(true)
      needsNewFile.current = true
      await stopRecorderAndConcat()
      await recorder.startPlayer(originalFile)
    }
    catch (e) {
      // Don't throw the user out for this. They can still record, restart, and submit possibly
      Alert.alert("Error during playback. Please contact support if this keeps happening.")

    }
    lock.current = false
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

  const progressTutorial = () => {
    if (currentTutorialElement === 'question') setCurrentTutorialElement('record')
    if (currentTutorialElement === 'record') setCurrentTutorialElement('checklist')
    if (currentTutorialElement === 'checklist') setCurrentTutorialElement('misc')
    if (currentTutorialElement === 'misc') setCurrentTutorialElement('x')
    if (currentTutorialElement === 'x') setCurrentTutorialElement('check')
    if (currentTutorialElement === 'check') onCompleteTutorial()
  }

  React.useEffect(() => {
    setIsInTutorial(!completedTutorial)
  }, [completedTutorial])

  const getConvertedRecordTime = () => {
    const minutes = Math.floor(recordTime / 60)
    const seconds = recordTime % 60
    const needsLeadingZero = seconds < 10
    return `${minutes}:${needsLeadingZero ? '0' : ''}${seconds}`
  }

  if (!ready) return (
    <View style={styles.whiteBackdrop}>
      <LinearGradient
        style={styles.container}
        // alternatively rgba(255,0,138,0.25)
        colors={['#FFADBB', 'rgba(255,181,38,0.25)']}
      />
    </View>
  )

  return (
    <View style={styles.whiteBackdrop}>
      <LinearGradient
        style={styles.container}
        // alternatively rgba(255,0,138,0.25)
        colors={isInTutorial ? ['#FFADBB99', 'rgba(255,181,38,0.1)'] : ['#FFADBB', 'rgba(255,181,38,0.25)']}
      >
        <Modal
          isVisible={modalVisible}
          onBackdropPress={() => setModalVisible(false)}
          animationIn="fadeIn"
          animationOut="fadeOut"
          useNativeDriver={true}
        >
          <View style={styles.modalOuter}>
            <View style={styles.modalInner}>
              <Text style={styles.modalText}>{modalText}</Text>
              {modalConfirm ? (
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} activeOpacity={0.3} onPress={() => setModalVisible(false)}>
                    <Text style={styles.buttonText}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmButton} activeOpacity={0.3} onPress={modalConfirm}>
                    <Text style={styles.buttonText}>Yes</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.modalOneButton}>
                  <TouchableOpacity style={styles.cancelButton} activeOpacity={0.3} onPress={() => setModalVisible(false)}>
                    <Text style={styles.buttonText}>Ok</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
        
        <TutorialElement
          onPress={progressTutorial}
          currentElement={currentTutorialElement}
          id={"question"}
          isInTutorial={isInTutorial}
          calloutTheme={"question"}
          calloutText={"This is the current question; a new one comes out every few days. Answer it to the best of your ability. Tap me now!"}
          calloutDistance={30}
        >
          <Text style={[styles.header, resizeTitle(screenSize)]}>
            { question.text }
          </Text>
        </TutorialElement>
        
        <TutorialElement
          onPress={progressTutorial}
          currentElement={currentTutorialElement}
          id={"record"}
          isInTutorial={isInTutorial}
          calloutTheme={"question"}
          calloutText={"This is the recorder. After the tutorial ends you can press it to record your answer! Press it again to pause. You have a 5 minute time limit, so make sure to pause when you aren't speaking. If you're speaking loud enough, it'll make pretty colors!"}
          calloutDistance={33}
        >
          <ShakeElement ref={recorderShaker}>
            <Shadow radius={getAudioCircleSize(screenSize)} style={{ marginTop: 30 }} disabled={isInTutorial && currentTutorialElement !== "record"}>
              {Object.values(circles)}
              <TouchableOpacity
                style={[styles.audioCircle, resizeAudioCircle(screenSize), started ? (recording ? styles.redCircle : styles.yellowCircle) : styles.whiteCircle]}
                onPress={recordPressed}
                activeOpacity={1}
              >
                <Image
                  source={Mic}
                  style={{ width: resizeMic(screenSize) }}
                  resizeMode={'contain'}
                />
              </TouchableOpacity>
            </Shadow>
          </ShakeElement>
        </TutorialElement>
        
        <TutorialElement
          onPress={progressTutorial}
          currentElement={currentTutorialElement}
          id={"record"}
          isInTutorial={isInTutorial}
        >
          <Text style={[styles.timer, recordTime < 240 ? {} : styles.timerWarning]}>
            { getConvertedRecordTime() } / 5:00
          </Text>
        </TutorialElement>
        
        <View style={{flex: 1}}>
          <TutorialElement
            onPress={progressTutorial}
            currentElement={currentTutorialElement}
            id={"checklist"}
            isInTutorial={isInTutorial}
            calloutTheme={"question"}
            calloutText={"This is a checklist to make sure you answer the question thoroughly. Make sure all of them are addressed and checked before submitting!"}
            calloutDistance={-230}
            measureDistanceFromBottom={false}
            inheritedFlex={1}
          >
            <Checklist type={question.category} ref={checklist} disabledPress={started ? undefined : informBeginRecording} />
          </TutorialElement>
        </View>

        <BottomButtons
          theme={"question"}
          xPressed={started ? restartRecording : informBeginRecording}
          checkPressed={started ? submitRecording : informBeginRecording}
          miscPressed={started ? hearRecording : informBeginRecording}
          isInTutorial={isInTutorial}
          currentTutorialElement={currentTutorialElement}
          onTutorialPress={progressTutorial}
          submitting={submitting}
        />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  whiteBackdrop: {
    backgroundColor: 'white',
    flex: 1
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    // TODO certain devices may need more padding if SafetyArea doesnt account for top bar
    paddingTop: Platform.OS === "ios" ? 30 : 20,
    alignItems: 'center'
  },

  header: {
    textAlign: 'center'
  },

  timer: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: -10,
    marginBottom: 10
  },

  timerWarning: {
    color: "#ff1f45"
  },

  audioCircle: {
    borderRadius:999,
    alignItems: 'center',
    justifyContent: 'center'
  },

  whiteCircle: {
    backgroundColor: 'white',
  },

  // TODO is this good color?
  redCircle: {
    backgroundColor: '#FFADBB',
  },

  yellowCircle: {
    backgroundColor: '#FFF3B2',
  },

  modalInner: {
    width: 320, 
  },

  modalOuter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  modalText: {
    fontSize: 25,
    textAlign: 'center',
    backgroundColor: 'rgb(255, 212, 198)',
    borderRadius: 20,
    overflow: "hidden",
    padding: 10,
    paddingVertical: 15,
    borderColor: '#FFADBB',
    borderWidth: 3,
  },

  buttonText: {
    fontSize: 25,
    fontWeight: 'bold'
  },

  confirmButton: {
    width: 100,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFADBB',
    borderRadius: 20,
  },

  cancelButton: {
    width: 100,
    alignItems: 'center',
    padding: 13,
    borderColor: '#FFADBB',
    borderWidth: 3,
    borderRadius: 20,
    backgroundColor: 'rgb(255, 212, 198)',
  },
  
  modalButtons: {
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginTop: 30
  },
  
  modalOneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30
  }
});

export default Question;
