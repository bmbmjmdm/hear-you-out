import React from 'react'

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
