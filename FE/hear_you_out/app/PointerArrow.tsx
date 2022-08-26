
import React from 'react'
import { useEffect, useRef, useState, useContext } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { resizePointerArrowOffset, getPointerArrowSize, SizeContext } from './helpers';
import Arrow from './pointerArrow.png'

export const PointerArrow = ({ beginAnimation, beganAction }) => {
  const boxedBeganAction = useRef(true)
  boxedBeganAction.current = beganAction
  const [finishedAnimation, setFinishedAnimation] = useState(false)
  const [arrowOpacity, setArrowOpacity] = useState(0)
  const screenSize = useContext(SizeContext)
  const offset = resizePointerArrowOffset(screenSize);
  const size = getPointerArrowSize(screenSize);
  const revealVeilCounter = useRef(new Animated.Value(0)).current
  const hideVeilCounter = useRef(new Animated.Value(0)).current

  // The starting state has the arrow positioned just bottom-right of the main white circle. It has a black box over it and another black box to its bottom-right
  // After a certain amount of time, if the user hasnt clicked the white circle yet, we display the arrow but sliding the box obfuscating it off (to the top-left)
  // Once they click the button, if the arrow is revealed, we hide it by sliding the Other black box (to the arrow's bottom-right) over it (by sliding it up-left)
  const revealVeilPosition = {
    top: animatedOffsetCalculation(false, revealVeilCounter, -size),
    left: animatedOffsetCalculation(false, revealVeilCounter, size, true),
  }
  const hideVeilPosition = {
    top: animatedOffsetCalculation(true, hideVeilCounter, -size),
    left: animatedOffsetCalculation(true, hideVeilCounter, size, true),
  }

  useEffect(() => {
    if (beginAnimation) {
      setTimeout(() => {
        if (!boxedBeganAction.current) {
          setArrowOpacity(1)
          Animated.timing(revealVeilCounter, {
            useNativeDriver: false,
            duration: 650,
            toValue: 1
          }).start(() => setFinishedAnimation(true))
        }
      }, 5000)
    }
  }, [beginAnimation])

  useEffect(() => {
    if (finishedAnimation && beganAction) {
      Animated.timing(hideVeilCounter, {
        useNativeDriver: false,
        duration: 400,
        toValue: 1
      }).start()
    }
  }, [finishedAnimation, beganAction])

  const containerStyle = {
    ...offset,
    height: size,
    width: size
    ,
    transform: [{
      rotateZ: '-45deg'
    }]
  }


  return (
    <View style={[containerStyle, styles.container]}>
      <Animated.Image
        source={Arrow}
        style={[{opacity: arrowOpacity}, styles.arrow]}
        resizeMode={'contain'} />
      <Animated.View style={[revealVeilPosition, styles.veil]} />
      <Animated.View style={[hideVeilPosition, styles.veil]} />
    </View>
  )
}

// the equation looks like Math.abs(size)? +- (counter * size)
const animatedOffsetCalculation = (addSize, counterValue, sizeNum, negative = false) => {
  const sizeValue = new Animated.Value(sizeNum)
  const parenthesis = Animated.multiply(counterValue, sizeValue)
  let signedParens = parenthesis
  if (negative) {
    signedParens = Animated.multiply(parenthesis, new Animated.Value(-1))
  }
  if (addSize) {
    const sizeAbsValue = new Animated.Value(Math.abs(sizeNum))
    return Animated.add(sizeAbsValue, signedParens) 
  }
  return signedParens
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    overflow: "hidden",
    elevation: -1,
    zIndex: -1,
  },
  arrow: {
    position: "absolute",
    height: "99%",
    width: "99%",
  },
  veil: {
    position: "absolute",
    backgroundColor: "#191919",
    height: "100%",
    width: "100%",
  },
});
