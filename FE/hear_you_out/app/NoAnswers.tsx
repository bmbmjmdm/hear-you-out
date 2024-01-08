
import React from 'react';
import {
  StyleSheet,
  Image,
  Text,
} from 'react-native';

import cat from './cat.png'
import LinearGradient from 'react-native-linear-gradient';
import { resizeCat, resizeHeaderMargin, SizeContext } from './helpers';
import analytics from '@react-native-firebase/analytics';

type NoAnswersProps = {
  setDisableSwipes: (toDisable: boolean) => void
  isShown: boolean
}

const NoAnswers = ({setDisableSwipes, isShown}: NoAnswersProps) => {
  const screenSize = React.useContext(SizeContext)

  React.useEffect(() => {
    analytics().logEvent('no_answers_screen');
  }, [])
  React.useEffect(() => {
    if (isShown) setDisableSwipes(false)
  }, [isShown])
  
  return (
    <LinearGradient
      style={styles.container}
      colors={['white', 'grey']}
    >
      <Text style={[styles.header, resizeHeaderMargin(screenSize)]}>
        No more answers available right now, check back later!
      </Text>
      <Image
        style={[styles.cat, resizeCat(screenSize)]}
        resizeMode='contain'
        source={cat}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  header: {
    fontSize: 35,
    textAlign: 'center',
    paddingHorizontal: 15,
  },
  
  cat: {
    alignSelf: 'flex-end',
  }
});

export default NoAnswers;
