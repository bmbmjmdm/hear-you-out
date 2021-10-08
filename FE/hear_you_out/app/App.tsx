
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

const App = () => {
  React.useEffect(() => {
    const asyncFun = async () => {
      console.log(Platform)
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
  })

  return (
      <Swiper
          cards={['Question', 'Answer', 'Question', 'Answer', 'Question', 'Answer', 'Question', 'Answer', 'Question', 'Answer', 'Question', 'Answer']}
          renderCard={(card) => {
              if (card === 'Question') {
                return <Question />
              }
              else {
                return <Answer />
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
          >
      </Swiper>
  );
};

const styles = StyleSheet.create({

});

export default App;
