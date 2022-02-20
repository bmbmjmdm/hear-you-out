
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
// https://github.com/react-native-linear-gradient/react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';
import Play from './Play.png';
import Pause from './Pause.png';
import Shadow from './Shadow'
import BottomButtons from './BottomButtons'
import Share from './Share.png';
import Flag from './Flag.png';
import { Slider } from 'react-native-elements';
import RNFS from 'react-native-fs'
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNShare from 'react-native-share'
import { APIQuestion } from "./Network"
import TutorialElement from './TutorialElement'
import { SizeContext } from './helpers'
import { getAudioCircleSize, resizeAudioCircle, resizePlayPause, resizeTitle } from './helpers'

type AnswerProps = {
  setDisableSwipes: (val: boolean) => void,
  id: string,
  answerAudioData: string,
  question: APIQuestion,
  onApprove: () => {},
  onDisapprove: () => {},
  onPass: () => {},
  onReport: () => {},
  completedTutorial: boolean,
  onCompleteTutorial: () => void,
  // an un-recoverable error has occured and we need to reload the app
  onError: () => void
}

const Answer = ({setDisableSwipes, id, answerAudioData, question, onDisapprove, onApprove, onPass, onReport, completedTutorial, onCompleteTutorial, onError}: AnswerProps) => {
  const screenSize = React.useContext(SizeContext)
  const [sliderValue, setSliderValue] = React.useState(0)
  const [length, setLength] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const disableUpdates = React.useRef(false)
  const lengthSetOnce = React.useRef(false)
  const started = React.useRef(false)
  const startedPerm = React.useRef(false)
  const [ready, setReady] = React.useState(false)
  const [currentTutorialElement, setCurrentTutorialElement] = React.useState("question")
  const [isInTutorial, setIsInTutorial] = React.useState(!completedTutorial)

  // modal
  const [modalVisible, setModalVisible] = React.useState(false)
  const [modalText, setModalText] = React.useState("")
  const [modalConfirm, setModalConfirm] = React.useState<() => void>(() => {})

  // initialize the player and setup callbacks
  const player = React.useRef(new AudioRecorderPlayer()).current
  const extention = Platform.OS === 'android' ? ".mp4" : ".m4a"
  const prepend = Platform.OS === 'android' ? "" : "file://"
  const filepath = prepend + RNFS.CachesDirectoryPath + '/' + "CoolAnswer" + id + extention

  const playbackListener = ({currentPosition, duration}) => {
    // if length is set more than once it'll break the slider
    if (!lengthSetOnce.current) {
      setLength(duration)
      lengthSetOnce.current = true
      return
    }
    // dont update value while user is moving slider manually
    if (disableUpdates.current) return
    // the answer finished playing
    if (currentPosition === duration) {
      setPlaying(false)
      setSliderValue(0)
      started.current = false
      return
    }
    // update slider value
    setSliderValue(currentPosition)
  }

  // run this effect ONCE when this component mounts to load the audio file and prep the player
  React.useEffect(() => {
    const asyncFun = async () => {
      try {
        await RNFS.writeFile(filepath, answerAudioData, 'base64').then(() => setReady(true))
        player.addPlayBackListener(playbackListener)
      }
      catch (e) {
        // cannot create our audio file, nothing we can do
        Alert.alert("Cannot write answer to file. Please contact support if this keeps happening.")
        onError()
      }
    }
    asyncFun()
    // run this return function ONCE when the component unmounts
    return () => {
      const asyncFunRet = async () => {
        try {
          player.removePlayBackListener()
          await player.stopPlayer()
          await RNFS.unlink(filepath)
        }
        catch (e) {
          console.log("failed to stop/unlink answer on unmount")
          // we're already unmounted, so don't worry about it
        }
      }
      asyncFunRet()
    }
  }, [])
  
  // UI functions
  const onSlidingStart = () => {
    // dont let the user accidentily swipe the overall card
    setDisableSwipes(true)
    // dont update our position since the users moving it
    disableUpdates.current = true
  }
  
  const onSlidingComplete = async (val) => {
    if (startedPerm.current) {
      // we already listened to some of the answer, and since we disabled swipes to slide, we need to re-enable them
      setDisableSwipes(false)
    }
    if (!started.current) { 
      // if the user finished the audio and wants to seek back, we have to "restart" it for them without them knowing
      started.current = true
      try {
        await player.startPlayer(filepath)
        await player.pausePlayer()
      }
      catch (e) {
        console.log("start then pause failed")
        // let restart fail silently, its not worth reloading the app over and for MVP the user can recover manually
      }
    }
    try {
      await player.seekToPlayer(val)
    }
    catch (e) {
      // same as above catch
      Alert.alert("Failed to seek. Please contact support if this keeps happening.")
    }
    disableUpdates.current = false
  }

  const playPressed = async () => {
    // we're already playing, pause
    if (playing) {
      try {
        await player.pausePlayer()
      }
      catch (e) {
        Alert.alert("Failed to pause. Please contact support if this keeps happening.")
      }
    }
    // we're not playing but we already started, resume
    else if (started.current) {
      setDisableSwipes(false)
      try {
        await player.resumePlayer()
      }
      catch (e) {
        // if we cant resume the player, try to restart
        try {
          console.log("failed to resume player, restarting")
          await player.startPlayer(filepath)
        }
        catch (e) {
          // if we cant start the player, this is a serious problem
          Alert.alert("Cannot play answer. Please contact support if this keeps happening.")
          onError()
        }
      }
      setPlaying(!playing)
    }
    // we're not playing and didnt start yet, so start
    else {
      started.current = true
      startedPerm.current = true
      setDisableSwipes(false)
      try {
        await player.startPlayer(filepath)
      }
      catch (e) {
        // if we cant start the player, this is a serious problem
        Alert.alert("Cannot play answer. Please contact support if this keeps happening.")
        onError()
      }
    }
    setPlaying(!playing)
  }

  const informBeginPlaying = () => {
    setModalText("You need to listen to the answer first!")
    setModalConfirm(null)
    setModalVisible(true)
  }

  const shareAnswer = async () => {
    try {
      // note this method does not work with base64 files. we will have to convert the file to a normal mp3 or w.e and share it like that
      const options = {
        url: filepath
      }
      await RNShare.open(options)
    }
    catch (e) {
      if (e.message !== "User did not share") {
        Alert.alert("Failed to share. Please contact support if this keeps happening.")
      }
    }
  }

  const reportAnswer = () => {
    // user pressed first button, now they need to confirm
    setModalText("Report innapropriate answer?")
    setModalConfirm(() => confirmReportAnswer)
    setModalVisible(true)
  }

  const confirmReportAnswer = () => {
    setModalVisible(false)
    onReport()
  }

  const progressTutorial = () => {
    if (currentTutorialElement === 'question') setCurrentTutorialElement('play')
    if (currentTutorialElement === 'play') setCurrentTutorialElement('flag')
    if (currentTutorialElement === 'flag') setCurrentTutorialElement('share')
    if (currentTutorialElement === 'share') setCurrentTutorialElement('check')
    if (currentTutorialElement === 'check') setCurrentTutorialElement('x')
    if (currentTutorialElement === 'x') setCurrentTutorialElement('misc')
    if (currentTutorialElement === 'misc') onCompleteTutorial()
  }

  React.useEffect(() => {
    setIsInTutorial(!completedTutorial)
  }, [completedTutorial])

  if (!ready) return (
    <View style={styles.whiteBackdrop}>
      <LinearGradient
        style={styles.container}
        colors={['rgba(0,255,117,0.25)', 'rgba(0,74,217,0.25)']}
      />
    </View>
  )

  return (
    <View style={styles.whiteBackdrop}>
      <LinearGradient
        style={styles.container}
        colors={isInTutorial ? ['rgba(0,255,117,0.1)', 'rgba(0,74,217,0.1)'] : ['rgba(0,255,117,0.25)', 'rgba(0,74,217,0.25)']}
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
        
        <TutorialElement
          onPress={progressTutorial}
          currentElement={currentTutorialElement}
          id={"question"}
          isInTutorial={isInTutorial}
          calloutTheme={"answer"}
          calloutText={"Now you'll see answers by other people. They'll be answering the same question you just did."}
          calloutDistance={30}
        >
          <Text style={[styles.header, resizeTitle(screenSize)]}>
            { question.text }
          </Text>
        </TutorialElement>

        <TutorialElement
          onPress={progressTutorial}
          currentElement={currentTutorialElement}
          id={"play"}
          isInTutorial={isInTutorial}
          calloutTheme={"answer"}
          calloutText={"Use these to play, pause, fast-forward, and rewind"}
          calloutDistance={0}
        >
          <Shadow radius={getAudioCircleSize(screenSize)} style={{ marginTop: 30 }} disabled={isInTutorial && currentTutorialElement !== 'play'}>
            <TouchableOpacity
              style={[styles.audioCircle, resizeAudioCircle(screenSize), playing ? styles.yellowCircle : styles.whiteCircle]}
              onPress={playPressed}
              activeOpacity={1}
            >
              <Image
                source={playing ? Pause : Play}
                style={{ width: resizePlayPause(screenSize) }}
                resizeMode={'contain'}
              />
            </TouchableOpacity>
          </Shadow>
        </TutorialElement>

        <View style={styles.miscButtons}>
          <TutorialElement
            onPress={progressTutorial}
            currentElement={currentTutorialElement}
            id={"flag"}
            isInTutorial={isInTutorial}
            calloutTheme={"answer"}
            calloutText={"If the answer does not address the question or the various bullet points you did before, flag it here"}
            calloutDistance={-150}
            measureDistanceFromBottom={false}
          >
            <TouchableOpacity onPress={reportAnswer}>
              <Image
                source={Flag}
                style={{ width: 35, marginRight: 20 }}
                resizeMode={'contain'}
              />
            </TouchableOpacity>
          </TutorialElement>
          <TutorialElement
            onPress={progressTutorial}
            currentElement={currentTutorialElement}
            id={"share"}
            isInTutorial={isInTutorial}
            calloutTheme={"answer"}
            calloutText={"If you find this answer worth sharing, use this"}
            calloutDistance={-100}
            measureDistanceFromBottom={false}
          >
            <TouchableOpacity onPress={shareAnswer}>
              <Image
                source={Share}
                style={{ width: 35, marginLeft: 20 }}
                resizeMode={'contain'}
              />
            </TouchableOpacity>
          </TutorialElement>
        </View>

        <View style={{flex: 1}}>
          <TutorialElement
            onPress={progressTutorial}
            currentElement={currentTutorialElement}
            id={"play"}
            isInTutorial={isInTutorial}
          >
              {length ? 
                <Slider
                  style={{width: 300, height: 40}}
                  minimumValue={0}
                  maximumValue={length}
                  minimumTrackTintColor="#888888"
                  maximumTrackTintColor="#FFFFFF"
                  allowTouchTrack={true}
                  thumbTintColor="#000000"
                  value={sliderValue}
                  onSlidingComplete={onSlidingComplete}
                  onSlidingStart={onSlidingStart}
                  thumbStyle={{ height: 30, width: 30 }}
                  trackStyle={{ height: 8, borderRadius: 99 }}
                />
                :
                // we cannot change the maximumValue of Slider once its rendered, so we render a fake slider until we know length
                <View style={{ width: 300, height: 40, alignItems: "center", justifyContent: "center", flexDirection: "row" }}>
                  <View style={{ height: 30, width: 30, borderRadius: 999, backgroundColor:"#000000" }} />
                  <View style={{ width:270, height: 8, borderTopRightRadius: 99, borderBottomRightRadius: 99, backgroundColor: "#FFFFFF" }} />
                </View>
              }
          </TutorialElement>
        </View>

        <BottomButtons
          theme={"answer"}
          xPressed={startedPerm ? onDisapprove : informBeginPlaying}
          checkPressed={startedPerm ? onApprove : informBeginPlaying}
          miscPressed={startedPerm ? onPass : informBeginPlaying}
          isInTutorial={isInTutorial}
          currentTutorialElement={currentTutorialElement}
          onTutorialPress={progressTutorial}
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

  miscButtons: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: -50
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

  tooltipOuter: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    zIndex: 1
  },

  modalText: {
    fontSize: 25,
    textAlign: 'center',
    backgroundColor: '#BFECE7',
    borderRadius: 20,
    padding: 10,
    paddingVertical: 15,
    borderColor: '#A9C5F2',
    overflow: "hidden",
    borderWidth: 3,
  },

  buttonText: {
    fontSize: 25,
    fontWeight: 'bold'
  },

  // note this background color + the relevant border colors are slightly more saturated versions of the bottom background color
  confirmButton: {
    width: 100,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#A9C5F2',
    borderRadius: 20,
  },

  cancelButton: {
    width: 100,
    alignItems: 'center',
    padding: 13,
    borderColor: '#A9C5F2',
    borderWidth: 3,
    borderRadius: 20,
    backgroundColor: '#BFECE7',
  },
  
  modalButtons: {
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginTop: 30
  }
});

export default Answer;
