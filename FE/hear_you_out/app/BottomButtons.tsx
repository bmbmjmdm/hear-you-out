
import React from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableHighlight,
  ActivityIndicator
} from 'react-native';
import Shadow from './Shadow'
import Speaker from './Speaker.png'
import Skip from './Skip.png'
import { SizeContext } from './helpers'
import { getBBLargeSize, getBBSmallSize, resizeBBLarge, resizeBBSmall } from './helpers'
import Garbage from './garbage.png'
import ThumbsDown from './thumbsDown.png'
import ThumbsUp from './thumbsUp.png'
import RightArrow from './rightArrow.png'

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
      <Button theme={theme} name={'x'} onPress={xPressed} />
      <Button theme={theme} name={'misc'} onPress={miscPressed} />
      <Button theme={theme} name={'check'} onPress={checkPressed} submitting={submitting} />
    </View>
  )
};

const Button = ({name, theme, onPress, submitting = false}) => {
  const screenSize = React.useContext(SizeContext)
  const [pressed, setPressed] = React.useState(false)
  let radius;
  let style;
  let underlay;
  let image;
  let imageSize;

  if (name === "check") {
    const bgColor = theme === "question" ? "#FF8AB2" : "#ABFFB8"
    const pressedColor = theme === "question" ? "#C16A89" : "#598560"
    radius = getBBLargeSize(screenSize)
    underlay = pressedColor
    style = [styles.bigCircle, resizeBBLarge(screenSize), {backgroundColor: pressed ? underlay : bgColor}, pressed ? styles.depth : {}]
    image = theme === "question" ? RightArrow : ThumbsUp
    imageSize = theme === "question" ? (12/20) * radius : (12/20) * radius
  }
  else if (name === "x") {
    const bgColor = theme === "question" ? "#FFC5C3" : "#ABFFB8"
    const pressedColor = theme === "question" ? "#C69A99" : "#598560"
    radius = getBBLargeSize(screenSize)
    underlay = pressedColor
    style = [styles.bigCircle, resizeBBLarge(screenSize), {backgroundColor: pressed ? underlay : bgColor}, pressed ? styles.depth : {}]
    image = theme === "question" ? Garbage : ThumbsDown
    imageSize = theme === "question" ? (10/20) * radius : (12/20) * radius
  }
  else {
    radius = getBBSmallSize(screenSize)
    underlay = '#918a64'
    style = [styles.littleCircle, resizeBBSmall(screenSize), pressed ? {backgroundColor: underlay} : {}, pressed ? styles.depthSmall : {}]
    image = theme == "question" ? Speaker : Skip;
    imageSize =  theme === "question" ? (3/5) * radius : (2/3) * radius 
  }

  return (
    <Shadow radius={radius} disabled={pressed}>
      <TouchableHighlight
        onPressIn={() => setPressed(true)}
        onPressOut={() => setTimeout(() => setPressed(false), 100)}
        underlayColor={underlay}
        activeOpacity={1}
        style={style}
        onPress={onPress}
      >
        {submitting ? 
          <ActivityIndicator size="large" color="#111111" />
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
    </Shadow>
  )
}


const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: 'row'
  },
  bigCircle: {
    borderRadius:999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  littleCircle: {
    borderRadius:999,
    backgroundColor: '#FFF3B2',
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
