
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
import AudioRecorderPlayer, { PlayBackType } from 'react-native-audio-recorder-player';
import RNShare from 'react-native-share'
import { SizeContext } from './helpers'
import { getAudioCircleSize, resizeAudioCircle, resizePlayPause, resizeTitle } from './helpers'
import ShakeElement from './ShakeElement';
import FadeInElement from './FadeInElement'
import ModalContents from './ModalContents'

type AnswerProps = {
  setDisableSwipes: (val: boolean) => void,
  id: string,
  answerAudioData: string,
  question: string,
  onApprove: () => {},
  onDisapprove: () => {},
  onPass: () => {},
  onReport: () => {},
  completedTutorial: boolean,
  onCompleteTutorial: () => void,
  completedApproveTutorial: boolean,
  onCompleteApproveTutorial: () => void,
  completedDisapproveTutorial: boolean,
  onCompleteDisapproveTutorial: () => void,
  // an un-recoverable error has occured and we need to reload the app
  onError: () => void,
  isShown: boolean
}

const Answer = ({
    setDisableSwipes,
    id,
    answerAudioData,
    question,
    onDisapprove,
    onApprove,
    onPass,
    onReport,
    completedTutorial,
    onCompleteTutorial,
    completedApproveTutorial,
    onCompleteApproveTutorial,
    completedDisapproveTutorial,
    onCompleteDisapproveTutorial,
    onError,
    isShown
  }: AnswerProps) => {
  const screenSize = React.useContext(SizeContext)
  const [sliderValue, setSliderValue] = React.useState(0)
  const [length, setLength] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const disableUpdates = React.useRef(false)
  const lengthSetOnce = React.useRef(false)
  const started = React.useRef(false)
  const startedPerm = React.useRef(false)
  const [ready, setReady] = React.useState(false)
  const [currentTutorialElement, setCurrentTutorialElement] = React.useState("")

  // modal
  const [modalVisible, setModalVisible] = React.useState(false)
  const [modalText, setModalText] = React.useState("")
  const [modalConfirm, setModalConfirm] = React.useState<() => void>(() => {})
  const [approveTutorialModalVisible, setApproveTutorialModalVisible] = React.useState(false)
  const [disapproveTutorialModalVisible, setDisapproveTutorialModalVisible] = React.useState(false)

  // shaking
  const playerShaker = React.useRef()
  const [shookPlayer, setShookPlayer] = React.useState(false)

  // initialize the player and setup callbacks
  const player = React.useRef(new AudioRecorderPlayer()).current
  const extention = Platform.OS === 'android' ? ".mp4" : ".m4a"
  const prepend = Platform.OS === 'android' ? "" : "file://"
  const filepathRaw = RNFS.CachesDirectoryPath + '/' + "CoolAnswer" + id + extention
  const filepath = prepend + filepathRaw

  const playbackListener = ({currentPosition, duration}:PlayBackType) => {
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
    if (!shookPlayer) {
      playerShaker?.current?.shake()
      setShookPlayer(true)
    }
    else {
      setModalText("You need to listen to the answer first!")
      setModalConfirm(null)
      setModalVisible(true)
      setShookPlayer(false)
    }
  }

  const shareAnswer = async () => {
    if (!startedPerm.current) {
      informBeginPlaying();
      return;
    }
    try {
      // note this method does not work with base64 files. we will have to convert the file to a normal mp3 or w.e and share it like that
      const options = {
        url: "file://" + filepathRaw
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
    if (!startedPerm.current) {
      informBeginPlaying();
      return;
    }
    // user pressed first button, now they need to confirm
    setModalText("Report innapropriate answer?")
    setModalConfirm(() => confirmReportAnswer)
    setModalVisible(true)
  }

  const confirmReportAnswer = () => {
    setModalVisible(false)
    onReport()
  }

  const tryApproveAnswer = () => {
    if (!startedPerm.current) {
      informBeginPlaying();
      return;
    }
    if (completedApproveTutorial) {
      onApprove();
      return;
    }
    setApproveTutorialModalVisible(true)
  }

  const tryDisapproveAnswer = () => {
    if (!startedPerm.current) {
      informBeginPlaying();
      return;
    }
    if (completedDisapproveTutorial) {
      onDisapprove();
      return;
    }
    setDisapproveTutorialModalVisible(true)
  }

  const confirmApproveTutorial = (action: () => void) => {
    setApproveTutorialModalVisible(false)
    onCompleteApproveTutorial()
    action()
  }

  const confirmDisapproveTutorial = (action: () => void) => {
    setDisapproveTutorialModalVisible(false)
    onCompleteDisapproveTutorial()
    action()
  }

  React.useEffect(() => {
    // dumb way of progressing through tutorial, but a good place to start
    // TODO make more interactive
    if (!completedTutorial && isShown) {
      let waitTime = 500
      setTimeout(() => setCurrentTutorialElement('question'), waitTime) // let past card finish animating out before fading in question
      waitTime += 2500
      setTimeout(() => setCurrentTutorialElement('play'), waitTime) // 2 seconds to read the question
      waitTime += 16500
      setTimeout(() => setCurrentTutorialElement('misc'), waitTime) // 16 seconds to press button and listen to some of the answer
      waitTime += 2500
      setTimeout(() => setCurrentTutorialElement('bottom'), waitTime) // 2 seconds to see misc buttons
      waitTime += 750
      setTimeout(onCompleteTutorial, waitTime) // make sure bottom buttons are fully faded in before marking tutorial complete
    }
  }, [isShown])

  if (!ready) return (
    <LinearGradient
      style={styles.container}
      colors={['#191919', '#191919']}
    />
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
          text={modalText}
          type={"generic"}
          closeModal={() => setModalVisible(false)}
          genericModalConfirmCallback={modalConfirm}
        />
      </Modal>
      <Modal
        isVisible={approveTutorialModalVisible}
        onBackdropPress={() => setApproveTutorialModalVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        useNativeDriver={true}
      >
        <ModalContents
          type={"approve"}
          onApprove={() => confirmApproveTutorial(onApprove)}
          onShare={() => confirmApproveTutorial(shareAnswer)}
        />
      </Modal>
      <Modal
        isVisible={disapproveTutorialModalVisible}
        onBackdropPress={() => setDisapproveTutorialModalVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        useNativeDriver={true}
      >
        <ModalContents
          type={"disapprove"}
          onDisapprove={() => confirmDisapproveTutorial(onDisapprove)}
          onReport={() => confirmDisapproveTutorial(onReport)}
        />
      </Modal>
      
      <FadeInElement
        shouldFadeIn={currentTutorialElement === "question"}
        isVisibleWithoutAnimation={completedTutorial}
      >
        <Text style={[styles.header, resizeTitle(screenSize)]}>
          { question }
        </Text>
      </FadeInElement>

      <FadeInElement
        shouldFadeIn={currentTutorialElement === "play"}
        isVisibleWithoutAnimation={completedTutorial}
      >
        <ShakeElement ref={playerShaker}>
          <Shadow radius={getAudioCircleSize(screenSize)} style={{ marginTop: 30 }}>
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
        </ShakeElement>
      </FadeInElement>

      <FadeInElement
        shouldFadeIn={currentTutorialElement === "misc"}
        isVisibleWithoutAnimation={completedTutorial}
      >
        <View style={styles.miscButtons}>
          <TouchableOpacity onPress={reportAnswer}>
            <Image
              source={Flag}
              style={{ width: 35, marginRight: 20 }}
              resizeMode={'contain'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={shareAnswer}>
            <Image
              source={Share}
              style={{ width: 35, marginLeft: 20 }}
              resizeMode={'contain'}
            />
          </TouchableOpacity>
        </View>
      </FadeInElement>

      <View style={{flex: 1}}>
        <FadeInElement
          shouldFadeIn={currentTutorialElement === "play"}
          isVisibleWithoutAnimation={completedTutorial}
        >
          {length ? 
            <Slider
              style={{width: 300, height: 40}}
              minimumValue={0}
              maximumValue={length}
              minimumTrackTintColor="#848688"
              maximumTrackTintColor="#F0F3F5"
              allowTouchTrack={true}
              thumbTintColor="#F0F3F5"
              value={sliderValue}
              onSlidingComplete={onSlidingComplete}
              onSlidingStart={onSlidingStart}
              thumbStyle={{ height: 30, width: 30 }}
              trackStyle={{ height: 8, borderRadius: 99 }}
            />
            :
            // we cannot change the maximumValue of Slider once its rendered, so we render a fake slider until we know length
            <TouchableOpacity activeOpacity={1} onPress={informBeginPlaying}>
              <View style={{ width: 300, height: 40, alignItems: "center", justifyContent: "center", flexDirection: "row" }}>
                <View style={{ height: 30, width: 30, borderRadius: 999, backgroundColor:"#F0F3F5" }} />
                <View style={{ width:270, height: 8, borderTopRightRadius: 99, borderBottomRightRadius: 99, backgroundColor: "#F0F3F5" }} />
              </View>
            </TouchableOpacity>
          }
        </FadeInElement>
      </View>

      <FadeInElement
        shouldFadeIn={currentTutorialElement === "bottom"}
        isVisibleWithoutAnimation={completedTutorial}
        style={{width: "100%"}}
      >
        <BottomButtons
          theme={"answer"}
          xPressed={tryDisapproveAnswer}
          checkPressed={tryApproveAnswer}
          miscPressed={startedPerm.current ? onPass : informBeginPlaying}
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
    alignItems: 'center'
  },

  header: {
    textAlign: 'center',
    color: '#F0F3F5'
  },

  audioCircle: {
    borderRadius:999,
    height: 175,
    width: 175,
    alignItems: 'center',
    justifyContent: 'center'
  },

  whiteCircle: {
    backgroundColor: '#F0F3F5',
  },

  miscButtons: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: -50
  },

  yellowCircle: {
    backgroundColor: '#FFF689',
  },
});

export default Answer;
