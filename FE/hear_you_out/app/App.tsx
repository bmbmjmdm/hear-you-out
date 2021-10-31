
import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  Platform,
} from 'react-native';

// https://www.npmjs.com/package/react-native-deck-swiper
import Swiper from 'react-native-deck-swiper'
import Question from './Question'
import Answer from './Answer'
import PermissionsAndroid from 'react-native-permissions';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const App = () => {
  const [disableSwipes, setDisableSwipes] = React.useState(true)
  const swiper = React.useRef(null)

  const submitAnswer = async () => {
    // see recorder docs regarding rn-fetch-blob if you have trouble uploading file
    // TODO submit answer to server
    swiper.current.swipeRight()
    setDisableSwipes(false)
  }

  // get permissions
  React.useEffect(() => {
    const asyncFun = async () => {
      if (Platform.OS === 'android') {
        try {
          const grants = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.ANDROID.RECORD_AUDIO,
          ]);
          if (
            grants['android.permission.WRITE_EXTERNAL_STORAGE'] ===
              PermissionsAndroid.RESULTS.GRANTED &&
            grants['android.permission.READ_EXTERNAL_STORAGE'] ===
              PermissionsAndroid.RESULTS.GRANTED &&
            grants['android.permission.RECORD_AUDIO'] ===
              PermissionsAndroid.RESULTS.GRANTED
          ) {
            console.log('Permissions granted');
          } else {
            console.log('All required permissions not granted');
          }
        } catch (err) {
          console.warn(err);
        }
      }
    }
    asyncFun()
  }, [])

  return (
    <SafeAreaProvider>
      <Swiper
        cards={['Question', 'Answer', 'Answer', 'Answer', 'Answer', 'Answer', 'Answer']}
        renderCard={(card) => {
            if (card === 'Question') {
              return <Question submit={submitAnswer} />
            }
            else {
              return <Answer setDisableSwipes={setDisableSwipes} />
            }
        }}
        onSwiped={(cardIndex) => {}}
        onSwipedAll={() => {}}
        cardIndex={0}
        backgroundColor={'rgba(0,0,0,0)'}
        stackSize={2}
        cardVerticalMargin={0}
        cardHorizontalMargin={0}
        stackSeparation={0}
        stackScale={0}
        disableBottomSwipe={disableSwipes}
        disableLeftSwipe={disableSwipes}
        disableRightSwipe={disableSwipes}
        disableTopSwipe={disableSwipes}
        horizontalSwipe={!disableSwipes}
        verticalSwipe={!disableSwipes}
        onTapCardDeadZone={disableSwipes? Number.MAX_VALUE : 50}
        ref={swiper}
      />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({

});

export default App;
