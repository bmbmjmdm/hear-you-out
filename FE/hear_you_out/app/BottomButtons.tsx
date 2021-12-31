
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
import X from './X.png'
import Check from './Check.png'
import TutorialElement from './TutorialElement';

type BottomButtonsProps = {
  theme: "answer" | "question",
  xPressed: () => {},
  miscPressed: () => {},
  checkPressed: () => {},
  disabled: boolean,
  isInTutorial: boolean,
  currentTutorialElement: string,
  onTutorialPress: () => void,
  submitting?: boolean
}

const BottomButtons = ({theme, disabled, xPressed, miscPressed, checkPressed, isInTutorial, currentTutorialElement, onTutorialPress, submitting}: BottomButtonsProps) => {
  return (
    <View style={styles.container}>
      <Button theme={theme} name={'x'} onPress={xPressed} disabled={disabled} isInTutorial={isInTutorial} currentTutorialElement={currentTutorialElement} onTutorialPress={onTutorialPress} />
      <Button theme={theme} name={'misc'} onPress={miscPressed} disabled={disabled} isInTutorial={isInTutorial} currentTutorialElement={currentTutorialElement} onTutorialPress={onTutorialPress} />
      <Button theme={theme} name={'check'} onPress={checkPressed} disabled={disabled} isInTutorial={isInTutorial} currentTutorialElement={currentTutorialElement} onTutorialPress={onTutorialPress} submitting={submitting} />
    </View>
  )
};

// TODO disabled styles
const Button = ({name, theme, onPress, disabled, isInTutorial, currentTutorialElement, onTutorialPress, submitting = false}) => {
  const bgColor = theme == "question" ? "#FFADBB" : "#ABFFB8"
  const pressedColor = theme == "question" ? "#94636b" : "#598560"
  const [pressed, setPressed] = React.useState(false)
  let radius;
  let style;
  let underlay;
  let image;
  let imageSize;
  let calloutText;
  let calloutDistance

  if (name === "check") {
    radius = 100
    underlay = pressedColor
    style = [styles.bigCircle, {backgroundColor: pressed ? underlay : bgColor}, pressed ? styles.depth : {}]
    image = Check
    imageSize = 55
    calloutText = theme === 'question' ? "When you're ready to submit you answer, press this!" : "When you're ready to proceed to the next answer, you can use one of these bottom buttons or swipe. Use this button or swipe right if you agree with the answer"
    calloutDistance = theme === 'question' ? -300 : -400
  }
  else if (name === "x") {
    radius = 100
    underlay = pressedColor
    style = [styles.bigCircle, {backgroundColor: pressed ? underlay : bgColor}, pressed ? styles.depth : {}]
    image = X
    imageSize = 50
    calloutText = theme === 'question' ? "If you don't like what you've recorded, press this to delete your recording and start over" : "Use this button or swipe left if you disagree with the answer"
    calloutDistance = theme === 'question' ?  -300 : -300
  }
  else {
    radius = 60
    underlay = '#918a64'
    style = [styles.littleCircle, pressed ? {backgroundColor: underlay} : {}, pressed ? styles.depthSmall : {}]
    image = theme == "question" ? Speaker : Skip;
    imageSize = 40
    calloutText = theme === 'question' ? "To hear back what you've already recorded, press here" : "Use this button if you aren't sure whether you agree or not"
    calloutDistance = theme === 'question' ? -280 : -280
  }

  return (
    <TutorialElement
      onPress={onTutorialPress}
      id={name}
      isInTutorial={isInTutorial}
      currentElement={currentTutorialElement}
      calloutTheme={theme}
      calloutText={calloutText}
      calloutDistance={calloutDistance}
    >
      <Shadow radius={radius} disabled={pressed || (isInTutorial && currentTutorialElement !== name)}>
        <TouchableHighlight
          onPressIn={() => setPressed(true)}
          onPressOut={() => setTimeout(() => setPressed(false), 100)}
          underlayColor={underlay}
          activeOpacity={1}
          style={style}
          onPress={() => { if (!disabled) onPress() }}
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
    </TutorialElement>
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
