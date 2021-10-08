
import React from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableHighlight
} from 'react-native';
import Shadow from './Shadow'
import Speaker from './Speaker.png'
import Skip from './Skip.png'
import X from './X.png'
import Check from './Check.png'

const BottomButtons = ({theme, disabled, xPressed, miscPressed, checkPressed}) => {
  return (
    <View style={styles.container}>
      <Button theme={theme} name={'x'} onPress={xPressed} disabled={disabled} />
      <Button theme={theme} name={'misc'} onPress={miscPressed} disabled={disabled} />
      <Button theme={theme} name={'check'} onPress={checkPressed} disabled={disabled} />
    </View>
  )
};

// TODO disabled styles
const Button = ({name, theme, onPress, disabled}) => {
  const bgColor = theme == "question" ? "#FFADBB" : "#ABFFB8"
  const pressedColor = theme == "question" ? "#94636b" : "#598560"
  const [pressed, setPressed] = React.useState(false)
  let radius;
  let style;
  let underlay;
  let image;
  let imageSize;

  if (name === "check") {
    radius = 100
    underlay = pressedColor
    style = [styles.bigCircle, {backgroundColor: pressed ? underlay : bgColor}, pressed ? styles.depth : {}]
    image = Check
    imageSize = 55
  }
  else if (name === "x") {
    radius = 100
    underlay = pressedColor
    style = [styles.bigCircle, {backgroundColor: pressed ? underlay : bgColor}, pressed ? styles.depth : {}]
    image = X
    imageSize = 50
  }
  else {
    radius = 60
    underlay = '#918a64'
    style = [styles.littleCircle, pressed ? {backgroundColor: underlay} : {}, pressed ? styles.depthSmall : {}]
    image = theme == "question" ? Speaker : Skip;
    imageSize = 40
  }

  return (
    <Shadow radius={radius} disabled={pressed}>
      <TouchableHighlight
        onPressIn={() => setPressed(true)}
        onPressOut={() => setTimeout(() => setPressed(false), 100)}
        underlayColor={underlay}
        activeOpacity={1}
        style={style}
        onPress={() => { if (!disabled) onPress() }}
      >
        <Image
          source={image}
          style={{
            width: imageSize,
            height: imageSize
          }}
        />
      </TouchableHighlight>
    </Shadow>
  )
}


const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    alignItems: "center",
    flexDirection: 'row'
  },
  bigCircle: {
    borderRadius:999,
    height: 100,
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  littleCircle: {
    borderRadius:999,
    backgroundColor: '#FFF3B2',
    height: 60,
    width: 60,
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
