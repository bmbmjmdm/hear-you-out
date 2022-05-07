import React from 'react'
import { Animated } from 'react-native';
import uuid from 'react-native-uuid';

export type ScreenSize = "large" | "medium" | "small" | "tiny"
export const SizeContext = React.createContext<ScreenSize>("medium");

export const resizeTitle = (screenSize: ScreenSize) => {
   return {
     fontSize: 
      screenSize == "large" ? 40
      : screenSize == "small" ? 30
      : screenSize == "tiny" ? 25
      : 35 //default is 35 at medium
    }
}

export const getBBLargeSize = (screenSize: ScreenSize) => {
  return screenSize == "large" ? 125
    : screenSize == "small" ? 75
    : screenSize == "tiny" ? 50
    : 100 // default is 100 at medium
}

export const resizeBBLarge = (screenSize: ScreenSize) => {
  const size = getBBLargeSize(screenSize)
  return {
    height: size,
    width: size,
   }
}

export const getBBSmallSize = (screenSize: ScreenSize) => {
  return screenSize == "large" ? 80
    : screenSize == "small" ? 50
    : screenSize == "tiny" ? 40
    : 60 // default is 60 at medium
}

export const resizeBBSmall = (screenSize: ScreenSize) => {
  const size = getBBSmallSize(screenSize)
  return {
    height: size,
    width: size,
   }
}

export const resizeMic = (screenSize: ScreenSize) => {
  return screenSize == "large" ? 90
    : screenSize == "small" ? 60
    : screenSize == "tiny" ? 45
    : 75 // default is 75 at medium
}

export const resizePlayPause = (screenSize: ScreenSize) => {
  return screenSize == "large" ? 125
    : screenSize == "small" ? 75
    : screenSize == "tiny" ? 50
    : 100 // default is 100 at medium
}

export const getAudioCircleSize = (screenSize: ScreenSize) => {
  return screenSize == "large" ? 200
    : screenSize == "small" ? 150
    : screenSize == "tiny" ? 125
    : 175 // default is 175 at medium
}

export const resizeAudioCircle = (screenSize: ScreenSize) => {
  const size = getAudioCircleSize(screenSize)
  return {
    height: size,
    width: size,
   }
}

export const resizeHeaderMargin = (screenSize: ScreenSize) => {
  const size = screenSize == "large" ? 200
    : screenSize == "small" ? 100
    : screenSize == "tiny" ? 50
    : 150 // default is 150 at medium
  return {
    marginTop: size
   }
}

export const resizeCat = (screenSize: ScreenSize) => {
  const size = screenSize == "large" ? 400
    : screenSize == "small" ? 300
    : screenSize == "tiny" ? 250
    : 350 // default is 350 at medium
  const margin = screenSize == "large" ? 75
    : screenSize == "small" ? -25
    : screenSize == "tiny" ? -75
    : 25 // default is 25 at medium
  return {
    width: size,
    marginTop: margin
   }
}


// while the user is recording or audio is playing, we make a cute animation behind the record button
// create a circle that will fade out from the center in a random directon
export const animateCircle = (setCircles, screenSize, recordTimeForCircles = {current: 0}) => {
  // get an up-to-date mutable copy of the state so we set it right
  setCircles((lastState) => {
    const circlesCopy = {...lastState}
    // id of our animation
    const id: any = uuid.v4()
    // the animated value we'll use to drive our animation
    const anim = new Animated.Value(0)
    // a random degree from 0 to 360 in radians
    const rotation = Math.random() * 360 * Math.PI / 180
    // add the circle with all its values to our list of animations
    const randomColorNum = Math.floor(Math.random() * 11390625)
    const randomColorStr = "#" + (randomColorNum.toString(16).padStart(6, "0"))
    circlesCopy[id] = 
    (<Animated.View 
      key={id}
      style={[{
        // time limit changes color of circles to be darker
        backgroundColor: recordTimeForCircles.current < 240 ? randomColorStr : '#880000',
        borderRadius: 999,
        position: "absolute",
        elevation: -1,
        zIndex: -1,
        opacity: Animated.subtract(new Animated.Value(1), anim),
        transform: [
          // polar coordinate using our random rotation where distance goes from 0 to 100
          {translateY: Animated.multiply(Animated.multiply(anim, new Animated.Value(200)), new Animated.Value(Math.sin(rotation)))},
          {translateX: Animated.multiply(Animated.multiply(anim, new Animated.Value(200)), new Animated.Value(Math.cos(rotation)))}
        ]
      },
      resizeAudioCircle(screenSize)]}
    />)
    // kick off the animation
    Animated.timing(anim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true
    }).start(() => {
      // remove animation from our list after animation finishes
      // get a new copy 
      setCircles((lastState2) => {
        const circlesCopy2 = {...lastState2}
        circlesCopy2[id] = null
        return circlesCopy2
      })
    })
    // finish setting state
    return circlesCopy
  })
}