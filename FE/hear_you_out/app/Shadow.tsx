
import React from 'react';
// https://github.com/react-native-radial-gradient/react-native-radial-gradient
import RadialGradient from 'react-native-radial-gradient';

const Shadow = ({
  radius,
  style = {},
  disabled = false,
  children
}) => {
  const clear = 'rgba(0,0,0,0)'
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
      colors={[
        disabled ? clear : 'black',
        disabled ? clear : 'black',
        clear
      ]}
      stops={[
        0,
        0.80,
        1
      ]}
      center={[
        0.525 * radius,
        0.525 * radius
      ]}
      radius={0.525 * radius}
    >
      {children}
    </RadialGradient>
  );
};

export default Shadow;
