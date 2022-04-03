import {View, Animated, StyleSheet, Text, Dimensions, Easing} from 'react-native'
import React from 'react'

type FadeInElementProps = {
  children: React.ReactElement | React.ReactElement[],
  shouldFadeIn: boolean,
  isVisibleWithoutAnimation?: boolean,
}

const FadeInElement = ({ children, shouldFadeIn, isVisibleWithoutAnimation = false } : FadeInElementProps) => {
  const curOpacity = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    if (shouldFadeIn) {
      Animated.timing(curOpacity, {
        duration: 500,
        useNativeDriver: true,
        toValue: 1
      }).start()
    }
  }, [shouldFadeIn])

  return (
    <Animated.View style={{opacity: isVisibleWithoutAnimation ? 1 : curOpacity}}>
      <View style={shouldFadeIn || isVisibleWithoutAnimation ? {} : styles.disableClicks} />
      { children }
    </Animated.View>
  )
}


const styles = StyleSheet.create({
  disableClicks: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: '100%',
    zIndex: 1,
    elevation: 1
  },
})

export default FadeInElement