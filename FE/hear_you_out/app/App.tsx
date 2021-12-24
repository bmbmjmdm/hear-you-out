
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
import { APIAnswer, APIQuestion, getAnswer, getQuestion, submitAnswer } from './Network'
import AsyncStorage from '@react-native-async-storage/async-storage';

const App = () => {
  const [disableSwipes, setDisableSwipes] = React.useState(false)
  const swiper1 = React.useRef(null)
  const swiper2 = React.useRef(null)
  const [cards1, setCards1] = React.useState([])
  const [cards2, setCards2] = React.useState([])
  const [topStack, setTopStack] = React.useState(1)
  const [question, setQuestion] = React.useState<APIQuestion>({})

  React.useEffect(() => {
    const asyncFun = async () => {
      // load last answered question
      const lastQ = await AsyncStorage.getItem("lastQuestionAnswered")
      let lastQParsed
      if (lastQ) {
        lastQParsed = JSON.parse(lastQ)
        setQuestion(lastQParsed)
      }

      // load initial stacks
      loadStack(1, lastQParsed).then((questionPassthrough) => loadStack(2, questionPassthrough))

      // ask for permissions on android
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

  const submitAnswerAndProceed = async (data:string) => {
    // see recorder docs regarding rn-fetch-blob if you have trouble uploading file
    const result = await submitAnswer({
      audio_data: data,
      question_uuid: question.key
    })
    // TODO error handling
    AsyncStorage.setItem("lastQuestionAnswered", JSON.stringify(question))
    if (topStack === 1) swiper1.current.swipeRight()
    else swiper2.current.swipeRight()
    setDisableSwipes(false)
  }

  // TODO error handling
  // on initial load we need to pass through the recently loaded question because it may not have been set yet
  const loadStack = async (stack:number, loadedQuestion?:APIQuestion) => {
    // set up the next question if the user hasn't already answered it
    const newQ = await getQuestion()
    if (question.key !== newQ.key && loadedQuestion?.key !== newQ.key) {
      if (!question.key) {
        // this is initial load and we have a question to show, so disable swipes
        setDisableSwipes(true)
      }
      setQuestion(newQ)
      const cardSetterCallback = (realCards) => [...realCards, "Question"]
      if (stack === 1) setCards1(cardSetterCallback)
      else setCards2(cardSetterCallback)
      return newQ
    }
    // no new question, so instead set up a new answer for the user to hear
    const newA = await getAnswer(loadedQuestion?.key || question.key)
    const cardSetterCallback = (realCards) => [...realCards, {
      id: newA.answer_uuid,
      data: newA.audio_data
    }]
    if (stack === 1) setCards1(cardSetterCallback)
    else setCards2(cardSetterCallback)
    return loadedQuestion
  }

  // when toggling top stack, we clear the completed (top) stack, move the bottom stack on top, initiate a load for the empty stack, and set disabled if we're showing a question
  const toggleTopStack = () => {
    if (topStack === 1) {
      setTopStack(2)
      setCards1([])
      loadStack(1)
      if (cards2[0] === "Question") setDisableSwipes(true)
    }
    else {
      setTopStack(1)
      setCards2([])
      loadStack(2)
      if (cards1[0] === "Question") setDisableSwipes(true)
    }
  }

  // since Swiper doesnt support adding more cards to an existing stack, we use 2 here to simulate a single stack. Whichever one is "beneath" gets refreshed and reloaded while the one "on top" is displayed
  // once the one on top runs out, the one below is shown and they swap jobs
  return (
    <SafeAreaProvider>
      {cards1.length ?
        <Swiper
          cards={cards1}
          renderCard={(card) => {
            if (card === 'Question') {
              return <Question submitAnswerAndProceed={submitAnswerAndProceed} question={question} />
            }
            else {
              return <Answer setDisableSwipes={setDisableSwipes} data={card.data} id={card.id} question={question} />
            }
          }}
          onSwiped={(cardIndex) => {}}
          onSwipedAll={() => {
            toggleTopStack()
          }}
          cardIndex={0}
          backgroundColor={'rgba(0,0,0,0)'}
          stackSize={1}
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
          ref={swiper1}
          keyExtractor={(val) => {
            if (val === "Question") return val
            else return val.id
          }}
          containerStyle={{
            top: 0,
            left: 0,  
            position: 'absolute',
            elevation: topStack === 1 ? 1 : 0,
            zIndex: topStack === 1 ? 10 : 0
          }}
        />
        : null
      }
      {cards2.length ?
        <Swiper
          cards={cards2}
          renderCard={(card) => {
            if (card === 'Question') {
              return <Question submitAnswerAndProceed={submitAnswerAndProceed} question={question} />
            }
            else {
              return <Answer setDisableSwipes={setDisableSwipes} data={card.data} id={card.id} question={question} />
            }
          }}
          onSwiped={(cardIndex) => {}}
          onSwipedAll={() => {
            toggleTopStack()
          }}
          cardIndex={0}
          backgroundColor={'rgba(0,0,0,0)'}
          stackSize={1}
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
          ref={swiper2}
          keyExtractor={(val) => {
            if (val === "Question") return val
            else return val.id
          }}
          containerStyle={{
            top: 0,
            left: 0,
            position: 'absolute',
            elevation: topStack === 2 ? 1 : 0,
            zIndex: topStack === 2 ? 10 : 0
          }}
        />
        : null
      }
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({

});

export default App;
