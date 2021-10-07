
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image
} from 'react-native';
// https://github.com/react-native-linear-gradient/react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';
import Mic from './Mic.png';
import Shadow from './Shadow'
import Checklist from './Checklist'
import BottomButtons from './BottomButtons'

const Question = () => {
  return (
    <View style={styles.whiteBackdrop}>
      <LinearGradient
        style={styles.container}
        // alternatively rgba(255,0,138,0.25)
        colors={['#FFADBB', 'rgba(255,181,38,0.25)']}
      >
        <Text style={styles.header}>
          What does class warfare look like to you?
        </Text>
        <Shadow radius={175} style={{ marginTop: 30 }}>
          <View style={styles.audioCircle}>
            <Image
              source={Mic}
              style={{ width: 75 }}
              resizeMode={'contain'}
            />
          </View>
        </Shadow>
        <Checklist type={"test"} />
        <BottomButtons theme={"question"} />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  whiteBackdrop: {
    backgroundColor: 'white',
    flex: 1
  },

  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center'
  },

  header: {
    fontSize: 35,
    textAlign: 'center'
  },

  audioCircle: {
    borderRadius:999,
    backgroundColor: 'white',
    height: 175,
    width: 175,
    alignItems: 'center',
    justifyContent: 'center'
  },
});

export default Question;
