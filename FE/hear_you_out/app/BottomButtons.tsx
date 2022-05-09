
import React from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableHighlight,
  ActivityIndicator
} from 'react-native';
import Shadow from './Shadow'
import { SizeContext } from './helpers'
import { getBBLargeSize, getBBSmallSize, resizeBBLarge, resizeBBSmall } from './helpers'
import Speaker from './Speaker.png'
import Skip from './Skip.png'
import SpeakerBlack from './SpeakerBlack.png'
import SkipBlack from './SkipBlack.png'
import Garbage from './garbage.png'
import ThumbsDown from './thumbsDown.png'
import ThumbsUp from './thumbsUp.png'
import RightArrow from './rightArrow.png'
import GarbageBlack from './garbageBlack.png'
import ThumbsDownBlack from './thumbsDownBlack.png'
import ThumbsUpBlack from './thumbsUpBlack.png'
import RightArrowBlack from './rightArrowBlack.png'

type BottomButtonsProps = {
  theme: "answer" | "question",
  xPressed: () => void,
  miscPressed: () => void,
  checkPressed: () => void,
  submitting?: boolean
}

const BottomButtons = ({theme, xPressed, miscPressed, checkPressed, submitting}: BottomButtonsProps) => {
  return (
    <View style={styles.container}>
      <BottomButton theme={theme} name={'x'} onPress={xPressed} />
      <BottomButton theme={theme} name={'misc'} onPress={miscPressed} />
      <BottomButton theme={theme} name={'check'} onPress={checkPressed} submitting={submitting} />
    </View>
  )
};

export const BottomButton = ({name, theme, onPress, submitting = false, extraDark = false}) => {
  const screenSize = React.useContext(SizeContext)
  const [pressed, setPressed] = React.useState(false)
  const backgroundColor = extraDark ? "#101010" : "#191919"
  let radius;
  let style;
  let image;
  let imageSize;
  let color

  if (name === "check") {
    color = "#659B5E"
    radius = getBBLargeSize(screenSize)
    style = [styles.bigCircle, resizeBBLarge(screenSize), {borderColor: color, borderWidth: 2, backgroundColor: pressed ? color : backgroundColor}]
    if (theme === "question") image = pressed ? RightArrowBlack : RightArrow
    else image = pressed ? ThumbsUpBlack : ThumbsUp
    imageSize = theme === "question" ? (12/20) * radius : (12/20) * radius
  }
  else if (name === "x") {
    color = "#AA5042"
    radius = getBBLargeSize(screenSize)
    style = [styles.bigCircle, resizeBBLarge(screenSize), {borderColor: color, borderWidth: 2, backgroundColor: pressed ? color : backgroundColor}]
    if (theme === "question") image = pressed ? GarbageBlack : Garbage
    else image = pressed ? ThumbsDownBlack : ThumbsDown
    imageSize = theme === "question" ? (10/20) * radius : (12/20) * radius
  }
  else {
    color = "#FFF689"
    radius = getBBSmallSize(screenSize)
    style = [styles.littleCircle, resizeBBSmall(screenSize), {borderColor: color, borderWidth: 1, backgroundColor: pressed ? color : backgroundColor}]
    if (theme === "question") image = pressed ? SpeakerBlack : Speaker
    else image = pressed ? SkipBlack : Skip
    imageSize =  theme === "question" ? (3/5) * radius : (2/3) * radius 
  }

  return (
    <TouchableHighlight
      onPressIn={() => setPressed(true)}
      onPressOut={() => setTimeout(() => setPressed(false), 100)}
      underlayColor={color}
      activeOpacity={1}
      style={style}
      onPress={onPress}
    >
      {submitting ? 
        <ActivityIndicator size="large" color="#659B5E" />
        : 
        <Image
          source={image}
          style={{
            width: imageSize,
            height: imageSize
          }}
        />
      }
    </TouchableHighlight>
  )
}


const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: 'row',
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 25
  },
  bigCircle: {
    borderRadius:999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  littleCircle: {
    borderRadius:999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  depth: {
    marginTop: 3,
    marginLeft: 3
  },
  depthSmall: {
    marginTop: 2,
    marginLeft: 2
  },
});

export default BottomButtons;
