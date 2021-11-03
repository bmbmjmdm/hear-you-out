
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
import Play from './Play.png';
import Pause from './Pause.png';
import Shadow from './Shadow'
import BottomButtons from './BottomButtons'
import Share from './Share.png';
import Flag from './Flag.png';
import { Slider } from 'react-native-elements';
import RNFS from 'react-native-fs'
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

const Answer = ({setDisableSwipes}) => {
  const [sliderValue, setSliderValue] = React.useState(0)
  const [length, setLength] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const disableUpdates = React.useRef(false)
  const lengthSetOnce = React.useRef(false)
  const started = React.useRef(false)

  // initialize the player and setup callbacks
  const player = React.useRef(new AudioRecorderPlayer()).current
  const extention = Platform.OS === 'android' ? ".mp4" : ".m4a"
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
  // run this effect ONCE when this component mounts
  React.useEffect(() => {
    player.addPlayBackListener(playbackListener)
    // run this return function ONCE when the component unmounts
    return () => {
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
    setDisableSwipes(false)
    if (!started.current) { 
      // if the user finished the audio and wants to seek back, we have to "restart" it for them without them knowing
      started.current = true
      await player.startPlayer(RNFS.CachesDirectoryPath + '/' + "HearYouOutRecordOriginal" + extention)
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
      // theoretical base64 encode/decode: 
      //const res = await RNFS.readFile(RNFS.CachesDirectoryPath + '/' + "HearYouOutRecordOriginal" + extention, 'base64')
      //await RNFS.writeFile(RNFS.CachesDirectoryPath + '/' + "HearYouOutRecordOriginal" + extention, res, 'base64')
      await player.startPlayer(RNFS.CachesDirectoryPath + '/' + "HearYouOutRecordOriginal" + extention)
    }
    setPlaying(!playing)
  }

  return (
    <View style={styles.whiteBackdrop}>
      <LinearGradient
        style={styles.container}
        colors={['rgba(0,255,117,0.25)', 'rgba(0,74,217,0.25)']}
      >
        <Text style={styles.header}>
          What does class warfare look like to you?
        </Text>
        <Shadow radius={175} style={{ marginTop: 30 }}>
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
        <View style={styles.miscButtons}>
          <Image
            source={Flag}
            style={{ width: 35, marginRight: 20 }}
            resizeMode={'contain'}
          />
          <Image
            source={Share}
            style={{ width: 35, marginLeft: 20 }}
            resizeMode={'contain'}
          />
        </View>
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
        <BottomButtons theme={"answer"} />
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
  }
});

export default Answer;
