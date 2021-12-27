
import React from 'react';
import {
  StyleSheet,
  Platform,
  View,
  ActivityIndicator,
} from 'react-native';

// https://www.npmjs.com/package/react-native-deck-swiper
import Swiper from 'react-native-deck-swiper'
import Question from './Question'
import Answer from './Answer'
import PermissionsAndroid from 'react-native-permissions';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { APIQuestion, getAnswer, getQuestion, rateAnswer, submitAnswer, reportAnswer } from './Network'
import AsyncStorage from '@react-native-async-storage/async-storage';

type AnswerCard = {
  id: string,
  data: string
}

const App = () => {
  const [disableSwipes, setDisableSwipes] = React.useState(true)
  const swiper1 = React.useRef(null)
  const swiper2 = React.useRef(null)
  const [cards1, setCards1] = React.useState([])
  const [cards2, setCards2] = React.useState([])
  const [topStack, setTopStack] = React.useState(1)
  const [question, setQuestion] = React.useState<APIQuestion>({})

  React.useEffect(() => {
    // TODO error handling
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
  }

  const rateAnswerAndAnimate = async (card: AnswerCard, rating: number) => {
    await rateAnswer(card.id, rating)
  }

  const reportAnswerAndAnimate = async (card: AnswerCard) => {
    await reportAnswer(card.id)
  }

  // TODO error handling
  // on initial load we need to pass through the recently loaded question because it may not have been set yet
  const loadStack = async (stack:number, loadedQuestion?:APIQuestion) => {
    // set up the next question if the user hasn't already answered it
    const newQ = await getQuestion()
    if (question.key !== newQ.key && loadedQuestion?.key !== newQ.key) {
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
  // we also disable swipes because questions dont use them and answers need to unlock them 
  const toggleTopStack = () => {
    setDisableSwipes(true)
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
      <View style={{elevation: -1, zIndex: -1, position: 'absolute', left: 0, top: 0, width: "100%", height: "100%", alignItems: 'center', justifyContent: 'center'}}>
        {/* For now we dont set `animating` based on `loadStack`. If we need performance boost, maybe try that */}
        <ActivityIndicator size="large" color="#A9C5F2" />
      </View>
      {cards1.length ?
        <Swiper
          cards={cards1}
          renderCard={(card) => {
            if (card === 'Question') {
              return <Question submitAnswerAndProceed={submitAnswerAndProceed} question={question} />
            }
            else {
              return <Answer setDisableSwipes={setDisableSwipes} data={card.data} id={card.id} question={question} onApprove={() => swiper1.current.swipeRight()} onDisapprove={() => swiper1.current.swipeLeft()} onPass={() => swiper1.current.swipeTop()} onReport={() => swiper1.current.swipeBottom()} />
            }
          }}
          onSwiped={() => {}}
          onSwipedRight={(index) => {
            if (cards1[index] !== "Question") rateAnswerAndAnimate(cards1[index], 1)
          }}
          onSwipedLeft={(index) => {
            if (cards1[index] !== "Question") rateAnswerAndAnimate(cards1[index], -1)
          }}
          onSwipedTop={(index) => {
            if (cards1[index] !== "Question") rateAnswerAndAnimate(cards1[index], 0)
          }}
          onSwipedBottom={(index) => {
            if (cards1[index] !== "Question") reportAnswerAndAnimate(cards1[index])
          }}
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
          disableBottomSwipe={true}
          disableLeftSwipe={disableSwipes}
          disableRightSwipe={disableSwipes}
          disableTopSwipe={true}
          horizontalSwipe={!disableSwipes}
          verticalSwipe={false}
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
              return <Answer setDisableSwipes={setDisableSwipes} data={card.data} id={card.id} question={question} onApprove={() => swiper2.current.swipeRight()} onDisapprove={() => swiper2.current.swipeLeft()} onPass={() => swiper2.current.swipeTop()} onReport={() => swiper2.current.swipeBottom()} />
            }
          }}
          onSwiped={() => {}}
          onSwipedRight={(index) => {
            if (cards2[index] !== "Question") rateAnswerAndAnimate(cards2[index], 1)
          }}
          onSwipedLeft={(index) => {
            if (cards2[index] !== "Question") rateAnswerAndAnimate(cards2[index], -1)
          }}
          onSwipedTop={(index) => {
            if (cards2[index] !== "Question") rateAnswerAndAnimate(cards2[index], 0)
          }}
          onSwipedBottom={(index) => {
            if (cards2[index] !== "Question") reportAnswerAndAnimate(cards2[index])
          }}
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
          disableBottomSwipe={true}
          disableLeftSwipe={disableSwipes}
          disableRightSwipe={disableSwipes}
          disableTopSwipe={true}
          horizontalSwipe={!disableSwipes}
          verticalSwipe={false}
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
