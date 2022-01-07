
import React from 'react';
import {
  StyleSheet,
  Image,
  Text,
} from 'react-native';

import cat from './cat.png'
import LinearGradient from 'react-native-linear-gradient';

type NoAnswersProps = {
  setDisableSwipes: (toDisable: boolean) => void
}

const NoAnswers = ({setDisableSwipes}: NoAnswersProps) => {
  React.useEffect(() => {
    setDisableSwipes(false)
  }, [])
  return (
    <LinearGradient
      style={styles.container}
      colors={['white', 'grey']}
    >
      <Text style={styles.header}>
        No more answers available right now, check back later!
      </Text>
      <Image
        style={styles.cat}
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
    marginTop: 150,
    paddingHorizontal: 15
  },
  
  cat: {
    width: 350,
    alignSelf: 'flex-end',
    marginTop: 25
  }
});

export default NoAnswers;
