
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity
} from 'react-native';
// https://github.com/react-native-linear-gradient/react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';
import Mic from './Mic.png';
import Shadow from './Shadow'
import Checklist from './Checklist'
import BottomButtons from './BottomButtons'
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

const Question = () => {
  const recorder = React.useRef(new AudioRecorderPlayer()).current
  const [started, setStarted] = React.useState(false)
  const [recording, setRecording] = React.useState(false)
  const [playing, setPlaying] = React.useState(false)
  const [lock, setLock] = React.useState(false)
  const [checked, setChecked] = React.useState(false)
  const [checklist, setChecklist] = React.useState(false)
  

  // TODO test all this

  const recordPressed = async () => {
    if (lock) return
    setLock(true)
    if (!recording) {
      // stop playing
      if (playing) {
        await recorder.stopPlayer()
        setPlaying(false)
      }
      // set recording
      setRecording(true)
      // choose whether to resume or start
      if (started) {
        await recorder.resumeRecorder()
      }
      else {
        setStarted(true)
        // the first member of files is the current file location
        await recorder.startRecorder()
      }
    }
    setLock(false)
  }

  const recordReleased = async () => {
    if (lock) return
    setLock(true)
    if (recording) {
      setRecording(false)
      await recorder.pauseRecorder()
    }
    setLock(false)
  }

  const restartRecording = async () => {
    if (lock) return
    setLock(true)
    if (recording)  {
      return
    }
    if (playing) {
      await recorder.stopPlayer()
      setPlaying(false)
    }
    setStarted(false)
    await recorder.stopRecorder()
    await deleteCurrentFile()
    setLock(false)
  }

  const submitRecording = async () => {
    if (lock) return
    setLock(true)
    if (playing) await recorder.stopPlaying()
    await recorder.stopRecorder()
    // TODO await SUBMIT THE LAST ONE
    // TODO move on from this screen
    // until these 2 TODOs are done, always swipe the current question card away after pressing submit button
    await deleteCurrentFile()
    // we dont even care about cleaning up the states because we're gonna move on from this screen
    setLock(false)
  }

  const hearRecording = async () => {
    if (lock) return
    setLock(true)
    if (recording) {
      setLock(false)
      return
    }
    if (playing) {
      await recorder.stopPlayer()
    }
    // TODO you cannot playback the recorder while it is paused. figure out a way around this, maybe by cloning the file? maybe by breaking up the file into multiple files that we play consecutively?
    setPlaying(true)
    await recorder.startPlayer()
    setLock(false)
  }

  const deleteCurrentFile = async () => {
    if (lock) return
    setLock(true)
    // TODO
    /*
    Default path for android uri is {cacheDir}/sound.mp4.
    Default path for ios uri is {cacheDir}/sound.m4a.
    */
    setLock(false)
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
