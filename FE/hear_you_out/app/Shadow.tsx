
import React from 'react';
import { Platform } from 'react-native';
// https://github.com/surajitsarkar19/react-native-radial-gradient
import RadialGradient from 'react-native-radial-gradient';

// TODO for some reason the background doesnt show dark enough for some reason unless I change the values here while the app is running o.O
const Shadow = ({
  radius,
  style = {},
  disabled = false,
  children
}) => {
  const clear = 'rgba(0,0,0,0)'
  let colors
  let center
  let stops
  let finalRadius
  if (Platform.OS === "android") {
    colors = [
      disabled ? clear : 'black',
      disabled ? clear : 'black',
      disabled ? clear : 'black',
      disabled ? clear : 'black',
      disabled ? clear : 'black',
      clear
    ]
    finalRadius = 0.525 * radius
    // TODO test this center on android
    center = [
      0.535 * radius,
      0.535 * radius
    ]
    stops = [
      0,
      1
    ]
  }
  else {
    colors = [
      disabled ? clear : 'black',
      clear
    ]
    finalRadius = 0.525 * radius
    center = [
      0.535 * radius,
      0.535 * radius
    ]
    stops = [
      0.835,
      1
    ]
  }
  return (
    <RadialGradient 
      style={
        [
          style,
          {
            width: radius + 25,
            height: radius + 25,
            marginLeft: 25
          }
        ]
      }
      // this should ideally be just 3 entries, and stops should be [0, 0.8, 1], but theres a bug
      colors={colors}
      stops={stops}
      center={center}
      radius={finalRadius}
    >
      {children}
    </RadialGradient>
  );
};

export default Shadow;
