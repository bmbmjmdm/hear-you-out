
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
// https://github.com/react-native-linear-gradient/react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';
import Mic from './Mic.png';
import Shadow from './Shadow'
import Checklist from './Checklist'
import BottomButtons from './BottomButtons'
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs'
import { RNFFmpeg } from 'react-native-ffmpeg';

// for tutorial maybe
// https://reactnativeelements.com/docs/tooltip/



const Question = () => {
  // keep track of which items have been checked
  const [checked, setChecked] = React.useState(false)
  const [checklist, setChecklist] = React.useState(false)

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
  // we make a text file with our audio file paths listed for later concatenation
  React.useEffect(() => {
    const asyncFun = async () => {
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

  // TODO error handling on all these

  const recordPressed = async () => {
    if (lock || recording) return
    setLock(true)
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
        await recorder.startRecorder(additionalFile)
      }
      // we can simply unpause
      else {
        await recorder.resumeRecorder()
      }
    }
    // we havent started, create the original file and start
    else {
      setStarted(true)
      await recorder.startRecorder(originalFile)
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
    if (recording) {
      setRecording(false)
      await recorder.pauseRecorder()
    }
    setLock(false)
  }

  const restartRecording = async () => {
    if (lock || recording) return
    setLock(true)
    if (playing) {
      await recorder.stopPlayer()
      setPlaying(false)
    }
    setStarted(false)
    await stopRecorderAndConcat()
    await deleteCurrentFile()
    setLock(false)
  }

  const submitRecording = async () => {
    if (lock || recording) return
    setLock(true)
    if (playing) {
      await recorder.stopPlayer()
      setPlaying(false)
    }
    await stopRecorderAndConcat()
    // TODO await SUBMIT THE LAST ONE
    // TODO move on from this screen
    // see recorder docs regarding rn-fetch-blob if you have trouble uploading file
    // until these 2 TODOs are done, always swipe the current question card away after pressing submit button
    await deleteCurrentFile()
    // we dont even care about cleaning up the states because we're gonna move on from this screen
    setLock(false)
  }

  const hearRecording = async () => {
    if (lock || recording) return
    setLock(true)
    if (playing) {
      await recorder.stopPlayer()
    }
    setPlaying(true)
    setNeedsNewFile(true)
    await stopRecorderAndConcat()
    await recorder.startPlayer(originalFile)
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
    await recorder.stopRecorder()
    if (needsConcat) {
      // concat
      await RNFFmpeg.execute(`-f concat -safe 0 -i ${fileList} -c copy ${concatFile}`).then(result => console.log(`FFmpeg process exited with rc=${result}.`));
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
        <Text style={styles.header}>
          What does class warfare look like to you?
        </Text>
        <Shadow radius={175} style={{ marginTop: 30 }}>
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

  redCircle: {
    backgroundColor: '#FFADBB',
  },

  yellowCircle: {
    backgroundColor: '#FFF3B2',
  }
});

export default Question;
