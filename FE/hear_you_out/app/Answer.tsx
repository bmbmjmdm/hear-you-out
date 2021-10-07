
import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
} from 'react-native';
// https://github.com/react-native-linear-gradient/react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';

const Answer = () => {
  return (
    <View style={styles.whiteBackdrop}>
      <LinearGradient style={styles.container} colors={['rgba(0,255,117,0.25)', 'rgba(0,74,217,0.25)']}>
        <Text style={styles.header}>What does class warfare look like to you?</Text>
        <View style={styles.audioCircle}>

        </View>
        <View style={styles.checklist}>

        </View>
        <View style={styles.bottomButtons}>

        </View>
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
  },

  header: {
    fontSize: 35
  },

  audioCircle: {

  },

  checklist: {

  },

  bottomButtons: {

  },
});


export default Answer;
