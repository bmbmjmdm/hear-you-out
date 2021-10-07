
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableHighlight
} from 'react-native';
import Shadow from './Shadow'

const BottomButtons = ({theme}) => {
  const color = {
    backgroundColor: theme == "question" ? "#FFADBB" : "#ABFFB8"
  }

  const pressedColor = theme == "question" ? "#94636b" : "#598560"

  const [firstButtonPressed, setFirstButtonPressed] = React.useState(false)
  const [secondButtonpressed, setSecondButtonpressed] = React.useState(false)
  const [thirdButtonPressed, setThirdButtonPressed] = React.useState(false)

  // break these 3 buttons up into seperate components since they seem to be having performance issues?
  return (
    <View style={styles.container}>
      <Shadow radius={100} disabled={firstButtonPressed}>
        <TouchableHighlight
          onPressIn={() => setFirstButtonPressed(true)}
          onPressOut={() => setFirstButtonPressed(false)}
          underlayColor={pressedColor}
          activeOpacity={1}
          style={[styles.bigCircle, color]}
        >
          <View/>
        </TouchableHighlight>
      </Shadow>
      <Shadow radius={60} disabled={secondButtonpressed}>
        <TouchableHighlight
          onPressIn={() => setSecondButtonpressed(true)}
          onPressOut={() => setSecondButtonpressed(false)}
          underlayColor={'#918a64'}
          activeOpacity={1}
          style={styles.littleCircle}
        >
        <View/>
        </TouchableHighlight>
      </Shadow>
      <Shadow radius={100} disabled={thirdButtonPressed}>
        <TouchableHighlight
          onPressIn={() => setThirdButtonPressed(true)}
          onPressOut={() => setThirdButtonPressed(false)}
          underlayColor={pressedColor}
          activeOpacity={1}
          style={[styles.bigCircle, color]}
        >
        <View/>
        </TouchableHighlight>
      </Shadow>
    </View>
  )
};


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
  }
});

export default BottomButtons;
