import {View, Animated, StyleSheet, Text, Dimensions, Easing} from 'react-native'
import React, { useImperativeHandle, forwardRef } from 'react'

type ShakeElementProps = {
  children: React.ReactElement,
}

const ShakeElement = ({ children } : ShakeElementProps, ref) => {
  const xTranslate = React.useRef(new Animated.Value(0)).current

  useImperativeHandle(ref, () => ({
    shake: () => {
      console.log("hello")
      Animated.sequence([
        Animated.timing(xTranslate, {
          duration: 25,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
          toValue: 6
        }),
        Animated.timing(xTranslate, {
          duration: 50,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
          toValue: -6
        }),
        Animated.timing(xTranslate, {
          duration: 50,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
          toValue: 6
        }),
        Animated.timing(xTranslate, {
          duration: 50,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
          toValue: -6
        }),
        Animated.timing(xTranslate, {
          duration: 25,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
          toValue: 0
        })
      ]).start()
    }
  }))

  return (
    <Animated.View style={{
      transform: [
        {
          translateX: xTranslate
        }
      ]
    }}>
      { children }
    </Animated.View>
  )
}


const styles = StyleSheet.create({
})

export default forwardRef(ShakeElement)