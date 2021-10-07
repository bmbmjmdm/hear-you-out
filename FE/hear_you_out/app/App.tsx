
import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
} from 'react-native';

// https://www.npmjs.com/package/react-native-deck-swiper
import Swiper from 'react-native-deck-swiper'
import Question from './Question'
import Answer from './Answer'

const App = () => {
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
          onSwiped={(cardIndex) => {console.log(cardIndex)}}
          onSwipedAll={() => {console.log('onSwipedAll')}}
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
