
import React from 'react';
import {
  StyleSheet,
  Image,
  Text,
} from 'react-native';

import cat from './cat.png'
import LinearGradient from 'react-native-linear-gradient';
import { resizeCat, resizeHeaderMargin, SizeContext } from './helpers';

type NoAnswersProps = {
  setDisableSwipes: (toDisable: boolean) => void
}

const NoAnswers = ({setDisableSwipes}: NoAnswersProps) => {
  const screenSize = React.useContext(SizeContext)

  React.useEffect(() => {
    setDisableSwipes(false)
  }, [])
  
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
