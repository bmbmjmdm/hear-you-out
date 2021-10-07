
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image
} from 'react-native';
// https://github.com/react-native-linear-gradient/react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';
import Play from './Play.png';
import Shadow from './Shadow'
import BottomButtons from './BottomButtons'
import Share from './Share.png';
import Flag from './Flag.png';

const Answer = () => {
  return (
    <View style={styles.whiteBackdrop}>
      <LinearGradient
        style={styles.container}
        colors={['rgba(0,255,117,0.25)', 'rgba(0,74,217,0.25)']}
      >
        <Text style={styles.header}>
          What does class warfare look like to you?
        </Text>
        <Shadow radius={175} style={{ marginTop: 30 }}>
          <View style={styles.audioCircle}>
            <Image
              source={Play}
              style={{ width: 85, marginLeft: 13 }}
              resizeMode={'contain'}
            />
          </View>
        </Shadow>
        <View style={styles.miscButtons}>
          <Image
            source={Flag}
            style={{ width: 35, marginRight: 20 }}
            resizeMode={'contain'}
          />
          <Image
            source={Share}
            style={{ width: 35, marginLeft: 20 }}
            resizeMode={'contain'}
          />
        </View>
        <BottomButtons theme={"answer"} />
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

  miscButtons: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: -50
  }
});

export default Answer;
