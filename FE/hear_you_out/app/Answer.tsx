
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
import Play from './Play.png';
import Pause from './Pause.png';
import BottomButtons from './BottomButtons'
import Share from './Share.png';
import Flag from './Flag.png';
import { Slider } from 'react-native-elements';
import RNFS from 'react-native-fs'
import AudioRecorderPlayer, { PlayBackType } from 'react-native-audio-recorder-player';
import RNShare from 'react-native-share'
import { SizeContext } from './helpers'
import { resizeAudioCircle, resizePlayPause, resizeTitle, animateCircle } from './helpers'
import ShakeElement from './ShakeElement';
import FadeInElement from './FadeInElement'
import ModalContents from './ModalContents'
import { RNFFmpeg } from 'react-native-ffmpeg';
import { Buffer } from "buffer";

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
  completedShareTutorial: boolean,
  onCompleteShareTutorial: () => void,
  completedFlagTutorial: boolean,
  onCompleteFlagTutorial: () => void,
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
    completedShareTutorial,
    onCompleteShareTutorial,
    completedFlagTutorial,
    onCompleteFlagTutorial,
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
  const [circles, setCircles] = React.useState({})
  const [meterData, setMeterData] = React.useState([])
  const [loudExampleAmplitude, setLoudExampleAmplitude] = React.useState(500)
  // this is for the playback listener, we could update it whenever the playing state updates but id rather not
  const playingRef = React.useRef(false) 

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
  const pcmPathRaw = RNFS.CachesDirectoryPath + '/' + "PCM" + id + extention
  const pcmPath = prepend + pcmPathRaw

  const playbackListener = ({currentPosition, duration}:PlayBackType) => {
    // animate a circle every time we go above our exemplar loud amplitude.
    // check the surrounding 0.1 seconds to reduce misses
    let max = 0;
    const startingPosition = Math.max(0, currentPosition - 5)
    for (let i = startingPosition; i < 5 + startingPosition; i++) {
      if (meterData[i] > max) max = meterData[i]
    }
    if (max >= loudExampleAmplitude && playingRef.current) animateCircle("answer", setCircles, screenSize)
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
      playingRef.current = false
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
        await RNFS.writeFile(filepath, answerAudioData, 'base64')
        // convert the file to pcm solely to get an array of the audio data
        await RNFFmpeg.execute(`-y  -i ${filepath}  -acodec pcm_s16le -f s16le -ac 1 -ar 1000 ${pcmPath}`)
        // you're reading that right, we're reading the file using base64 only to decode the base64, because rn doesnt let us read raw data
        const pcmFile = Buffer.from(await RNFS.readFile(pcmPath, 'base64'), 'base64')
        let pcmData = []
        // byte conversion pulled off stack overflow
        for(var i = 0 ; i < pcmFile.length ; i = i + 2){
          var byteA = pcmFile[i];
          var byteB = pcmFile[i + 1];
          var sign = byteB & (1 << 7);
          var val = (((byteA & 0xFF) | (byteB & 0xFF) << 8)); // convert to 16 bit signed int
          if (sign) { // if negative
            val = 0xFFFF0000 | val;  // fill in most significant bits with 1's
          }
          const absVal = Math.abs(val)
          pcmData.push(absVal)
        }
        // we find an "exemplar amplitude", representing a 75th percentile loudness
        // TODO fix this when the array is lopsided, aka 75%+ is quiet or 75%+ is loud
        const sortedAmplitudes = [...pcmData].sort()
        const exemplarIndex = Math.round(sortedAmplitudes.length * 3 / 4)
        setLoudExampleAmplitude(sortedAmplitudes[exemplarIndex])
        // this is the resulting audio data array, higher value means higher amplitude
        setMeterData(pcmData)
      }
      catch (e) {
        console.log(e)
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
          await RNFS.unlink(pcmPath)
        }
        catch (e) {
          console.log("failed to stop/unlink answer on unmount")
          console.log(e)
          // we're already unmounted, so don't worry about it
        }
      }
      asyncFunRet()
    }
  }, [])

  React.useEffect(() => {
    if (meterData.length) {
      player.setSubscriptionDuration(0.2)
      player.addPlayBackListener(playbackListener)
      setReady(true)
    }
  }, [meterData])

  
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
        console.log(e)
        // let restart fail silently, its not worth reloading the app over and for MVP the user can recover manually
      }
    }
    try {
      await player.seekToPlayer(val)
    }
    catch (e) {
      console.log(e)
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
        console.log(e)
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
          console.log(e)
          await player.startPlayer(filepath)
        }
        catch (e2) {
          console.log(e2)
          // if we cant start the player, this is a serious problem
          Alert.alert("Cannot play answer. Please contact support if this keeps happening.")
          onError()
        }
      }
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
        console.log(e)
        // if we cant start the player, this is a serious problem
        Alert.alert("Cannot play answer. Please contact support if this keeps happening.")
        onError()
      }
    }
    setPlaying(!playing)
    playingRef.current = !playing
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
        console.log(e)
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
    if (completedShareTutorial) {
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
    if (completedFlagTutorial) {
      onDisapprove();
      return;
    }
    setDisapproveTutorialModalVisible(true)
  }

  const confirmApproveTutorial = (action: () => void) => {
    setApproveTutorialModalVisible(false)
    onCompleteShareTutorial()
    action()
  }

  const confirmDisapproveTutorial = (action: () => void) => {
    setDisapproveTutorialModalVisible(false)
    onCompleteFlagTutorial()
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
          <View style={{ marginTop: 30 }}>
            {Object.values(circles)}
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
          </View>
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
    alignItems: 'center',
    backgroundColor: "#191919"
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
    marginTop: -25
  },

  yellowCircle: {
    backgroundColor: '#659B5E',
  },
});

export default Answer;
