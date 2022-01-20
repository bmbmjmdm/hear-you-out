
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
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
  onCompleteTutorial: () => void
}

// TODO error handling on everything
const Answer = ({setDisableSwipes, id, answerAudioData, question, onDisapprove, onApprove, onPass, onReport, completedTutorial, onCompleteTutorial}: AnswerProps) => {
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
  const filepath = RNFS.CachesDirectoryPath + '/' + "CoolAnswer" + id + extention

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
    RNFS.writeFile(filepath, answerAudioData, 'base64').then(() => setReady(true))
    player.addPlayBackListener(playbackListener)
    // run this return function ONCE when the component unmounts
    return () => {
      RNFS.unlink(filepath)
      player.removePlayBackListener()
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
      await player.startPlayer(filepath)
      await player.pausePlayer()
    }
    await player.seekToPlayer(val)
    disableUpdates.current = false
  }

  const playPressed = async () => {
    // we're already playing, pause
    if (playing) {
      await player.pausePlayer()
    }
    // we're not playing, start
    else {
      started.current = true
      startedPerm.current = true
      setDisableSwipes(false)
      await player.startPlayer(filepath)
    }
    setPlaying(!playing)
  }

  const shareAnswer = async () => {
    try {
      // note this method does not work with base64 files. we will have to convert the file to a normal mp3 or w.e and share it like that
      const options = {
        url: "file://" + filepath
      }
      const result = await RNShare.open(options)
      console.log(result)
    }
    catch (e) {
      console.log(e)
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
          <Text style={styles.header}>
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
          <Shadow radius={175} style={{ marginTop: 30 }} disabled={isInTutorial && currentTutorialElement !== 'play'}>
            <TouchableOpacity
              style={[styles.audioCircle, playing ? styles.yellowCircle : styles.whiteCircle]}
              onPress={playPressed}
              activeOpacity={1}
            >
              <Image
                source={playing ? Pause : Play}
                style={{ width: 85, marginLeft: playing ? 0 : 13 }}
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
            calloutDistance={-20}
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
            calloutDistance={-20}
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

        <BottomButtons
          theme={"answer"}
          xPressed={onDisapprove}
          checkPressed={onApprove}
          miscPressed={onPass}
          disabled={!startedPerm.current}
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
