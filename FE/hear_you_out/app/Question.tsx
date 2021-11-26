
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import Modal from "react-native-modal";
// https://github.com/react-native-linear-gradient/react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';
import Mic from './Mic.png';
import Shadow from './Shadow'
import Checklist from './Checklist'
import BottomButtons from './BottomButtons'
import AudioRecorderPlayer, { AudioEncoderAndroidType } from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs'
import { RNFFmpeg } from 'react-native-ffmpeg';
import uuid from 'react-native-uuid';

// for tutorial maybe
// https://reactnativeelements.com/docs/tooltip/


// TODO find best settings for iOS
// https://github.com/hyochan/react-native-audio-recorder-player/blob/master/index.ts
const audioSet = {
  AudioEncoderAndroid: AudioEncoderAndroidType.HE_AAC, // AAC is slightly better quality but like 75% increase in size
  AudioEncodingBitRateAndroid: 102400, // increase to 128000 if we get more storage
  AudioSamplingRateAndroid: 48000,
  //AVSampleRateKeyIOS?: number;
  //AVFormatIDKeyIOS?: AVEncodingType;
  //AVNumberOfChannelsKeyIOS?: number;
  //AVEncoderAudioQualityKeyIOS?: AVEncoderAudioQualityIOSType;
  //AVLinearPCMBitDepthKeyIOS?: AVLinearPCMBitDepthKeyIOSType;
  //AVLinearPCMIsBigEndianKeyIOS?: boolean;
  //AVLinearPCMIsFloatKeyIOS?: boolean;
  //AVLinearPCMIsNonInterleavedIOS?: boolean;
}

const Question = ({ submit }) => {
  // keep track of which items have been checked
  const [checked, setChecked] = React.useState(false)
  const [checklist, setChecklist] = React.useState(false)
  const [circles, setCircles] = React.useState({})

  // modal
  const [modalVisible, setModalVisible] = React.useState(false)
  const [modalText, setModalText] = React.useState("")
  const [modalConfirm, setModalConfirm] = React.useState(() => {})

  // recorder/player
  const recorder = React.useRef(new AudioRecorderPlayer()).current
  // maintain a lock for the recorder so we only execute 1 function at time
  const [lock, setLock] = React.useState(false)
  // whether we started a recording
  const [started, setStarted] = React.useState(false)
  // whether we are currently recording
  const [recording, setRecording] = React.useState(false)
  // whether we are playing back what we've recorded so far
  const [playing, setPlaying] = React.useState(false)
  // each time we playback, we need to stop our recording, playback, and then start a new one when the user continues recording (we're not allowed to playback while paused)
  const [needsNewFile, setNeedsNewFile] = React.useState(false)
  // if we stop a recording that isnt the original file, concat it with the original file 
  const [needsConcat, setNeedsConcat] = React.useState(false)
  const extention = Platform.OS === 'android' ? ".mp4" : ".m4a"
  const originalFile = RNFS.CachesDirectoryPath + '/' + "HearYouOutRecordOriginal" + extention
  const additionalFile = RNFS.CachesDirectoryPath + '/' + "HearYouOutRecordAdditional" + extention
  const concatFile = RNFS.CachesDirectoryPath + '/' + "HearYouOutRecordConcated" + extention
  const fileList = RNFS.CachesDirectoryPath + '/' + "fileList.txt"
  // run this effect ONCE when this component mounts
  React.useEffect(() => {
    const asyncFun = async () => {
      // add a playback listener for recording animations
      recorder.setSubscriptionDuration(0.2)
      recorder.addRecordBackListener(({ currentMetering }) => {
        // TODO test this level on other devices, incl iOS
        if (currentMetering > -20) animateCircle()
      })
      // we make a text file with our audio file paths listed for later concatenation
      const paths = [originalFile, additionalFile]
      var listContent = ''
      paths.forEach(path => {
        listContent += `file '${path}'\n`
      });
      try {
        await RNFS.writeFile(fileList, listContent, 'utf8')
      } catch (error) {
      }
    }
    asyncFun()
  }, [])

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
        style={{
          // TODO is this good color?
          // TODO also this color is lighter for some reason than it should be. in fact "white" doesnt show at all.... doesnt matter too much, if we find a color that works then w.e
          backgroundColor: "#ff617c",
          height: 175,
          width: 175,
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
        }}
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

  // TODO error handling on all these

  // TODO set metering enabled so we can use it for background animation
  const recordPressed = async () => {
    if (lock || recording) return
    setLock(true)
    try {
      // stop playing
      if (playing) {
        await recorder.stopPlayer()
        setPlaying(false)
      }
      // set recording
      setRecording(true)
      // we've started already
      if (started) {
        // we've played back and need to start a new file to concat
        if (needsNewFile) {
          setNeedsNewFile(false)
          setNeedsConcat(true)
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
      
    }
    setLock(false)
  }

  const recordReleased = async () => {
    if (lock) {
      // if we ever wind up here, we dont want to miss the recordRelease event, so keep retrying
      setTimeout(recordReleased, 50)
      return
    }
    setLock(true)
    try { 
      if (recording) {
        setRecording(false)
        await recorder.pauseRecorder()
      }
    }
    catch (e) {
      
    }
    setLock(false)
  }

  const restartRecording = async () => {
    if (lock || recording) return
    // user pressed first button, now they need to confirm
    setModalText("Delete recording and restart?")
    setModalConfirm(() => restartRecordingConfirmed())
    setModalVisible(true)
  }

  const restartRecordingConfirmed = async () => {
    if (lock || recording) return
    setLock(true)
    try {
      if (playing) {
        await recorder.stopPlayer()
        setPlaying(false)
      }
      setStarted(false)
      await stopRecorderAndConcat()
      
      // when we're ready to measure iOS file sizes
      // console.log((await RNFS.stat(originalFile)).size)
  
      await deleteCurrentFile()
    }
    catch (e) {

    }
    setLock(false)
  }

  const submitRecording = async () => {
    if (lock || recording) return
    // user pressed first button, now they need to confirm
    setModalText("Submit your answer?")
    setModalConfirm(() => submitRecordingConfirmed)
    setModalVisible(true)
  }

  const submitRecordingConfirmed = async () => {
    if (lock || recording) return
    setLock(true)
    try {
      if (playing) {
        await recorder.stopPlayer()
        setPlaying(false)
      }
      await stopRecorderAndConcat()
      setModalVisible(false)
      await submit()
//TODO UNCOMMENT THIS WHEN DONE CODING
      //await deleteCurrentFile()
      // we dont even care about cleaning up the states because we're gonna move on from this screen
    }
    catch (e) {

    }
  }

  const hearRecording = async () => {
    if (lock || recording) return
    setLock(true)
    try {
      if (playing) {
        await recorder.stopPlayer()
      }
      setPlaying(true)
      setNeedsNewFile(true)
      await stopRecorderAndConcat()
      await recorder.startPlayer(originalFile)
    }
    catch (e) {

    }
    setLock(false)
  }

  const deleteCurrentFile = async () => {
    try {
      await RNFS.unlink(originalFile)
    }
    catch (e) {
      console.log("delete failed")
    }
  }
  
// TODO setup for ios
// https://www.npmjs.com/package/react-native-ffmpeg
// see 2.3.2 iOS to see about enabling audio package on iOS
  // concat original file + additional file => original file
  const stopRecorderAndConcat = async () => {
    console.log("stoping")
    await recorder.stopRecorder()
    console.log("stopped")
    if (needsConcat) {
      console.log("concatting")
      // concat
      const result = await RNFFmpeg.execute(`-f concat -safe 0 -i ${fileList} -c copy ${concatFile}`)
      console.log(`FFmpeg process exited with rc=${result}.`)
      // delete old files and rename the new one appropriately
      await RNFS.unlink(originalFile)
      await RNFS.unlink(additionalFile)
      await RNFS.moveFile(concatFile, originalFile)
      setNeedsConcat(false)
    }
  }

  return (
    <View style={styles.whiteBackdrop}>
      <LinearGradient
        style={styles.container}
        // alternatively rgba(255,0,138,0.25)
        colors={['#FFADBB', 'rgba(255,181,38,0.25)']}
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
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} activeOpacity={0.3} onPress={() => setModalVisible(false)}>
                <Text style={styles.buttonText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} activeOpacity={0.3} onPress={modalConfirm}>
                <Text style={styles.buttonText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
        <Text style={styles.header}>
          What does class warfare look like to you?
        </Text>
        <Shadow radius={175} style={{ marginTop: 30 }}>
          {Object.values(circles)}
          <TouchableOpacity
            style={[styles.audioCircle, started ? (recording ? styles.redCircle : styles.yellowCircle) : styles.whiteCircle]}
            onPressIn={recordPressed}
            onPressOut={recordReleased}
            activeOpacity={1}
          >
            <Image
              source={Mic}
              style={{ width: 75 }}
              resizeMode={'contain'}
            />
          </TouchableOpacity>
        </Shadow>
        <Checklist type={"test"} />
        <BottomButtons
          theme={"question"}
          xPressed={restartRecording}
          checkPressed={submitRecording}
          miscPressed={hearRecording}
          disabled={!started}
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
    padding: 20,
    alignItems: 'center'
  },

  header: {
    fontSize: 35,
    textAlign: 'center'
  },

  audioCircle: {
    borderRadius:999,
    height: 175,
    width: 175,
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
    padding: 20, 
    backgroundColor: '#FFD4C6',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFADBB'
  },

  modalOuter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  modalText: {
    fontSize: 25,
    textAlign: 'center'
  },

  buttonText: {
    fontSize: 25,
    fontWeight: 'bold'
  },

  confirmButton: {
    width: 100,
    alignItems: 'center',
    padding: 13,
    backgroundColor: '#FFADBB',
    borderRadius: 20
  },

  cancelButton: {
    width: 100,
    alignItems: 'center',
    padding: 13,
    borderColor: '#FFADBB',
    borderWidth: 3,
    borderRadius: 20,
  },
  
  modalButtons: {
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginTop: 20
  }
});

export default Question;
