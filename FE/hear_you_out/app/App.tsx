
import React from 'react';
import {
  StyleSheet,
  Platform,
  View,
  ActivityIndicator,
  AppState,
  Alert,
  useWindowDimensions,
} from 'react-native';

// https://www.npmjs.com/package/react-native-deck-swiper
import Swiper from 'react-native-deck-swiper'
import Question from './Question'
import Answer from './Answer'
import PermissionsAndroid from 'react-native-permissions';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { APIQuestion, getAnswer, getQuestion, rateAnswer, submitAnswer, reportAnswer, clearTempAnswerList } from './Network'
import AsyncStorage from '@react-native-async-storage/async-storage';
import NoAnswers from './NoAnswers'
import { ScreenSize, SizeContext } from './helpers'

type AnswerCard = {
  id: string,
  data: string
}

// TODO error handling on everything
const App = () => {
  const {height} = useWindowDimensions()
  let screenSize:ScreenSize = "medium"
  if (height < 600) screenSize = "tiny"
  else if (height < 750) screenSize = "small"
  else if (height < 1000) screenSize = "medium"
  else screenSize = "large"
  const [disableSwipes, setDisableSwipes] = React.useState(true)
  const swiper1 = React.useRef(null)
  const swiper2 = React.useRef(null)
  const [cards1, setCards1] = React.useState([])
  const [cards2, setCards2] = React.useState([])
  const [topStack, setTopStack] = React.useState(1)
  const [question, setQuestion] = React.useState<APIQuestion>({})
  const [completedQuestionTutorial, setCompletedQuestionTutorial ] = React.useState(false)
  const [completedAnswerTutorial, setCompletedAnswerTutorial ] = React.useState(false)
  const appState = React.useRef(AppState.currentState);
  const appStateListener = React.useRef(null);

  const loadLastQ = async () => {
    const recallableLoad = async () => {
      const lastQ = await AsyncStorage.getItem("lastQuestionAnswered")
      if (lastQ) {
        const result = JSON.parse(lastQ)
        setQuestion(result)
        return result
      }
    }
    try {
     return await recallableLoad()
    }
    catch (e) {
      // if we fail, make sure it isn't a blip.
      try {
        return await recallableLoad()
      }
      catch (ee) {
        // we can't do anything else, move on without a loading question
        Alert.alert("Unsure if previously answered. Please contact support if this keeps happening.")
      }
    }
  }

  React.useEffect(() => {
    const asyncFun = async () => {
      // check if theyve gone through the tutorials or not. do this async since we have to load the stacks anyway
      let checkQT = () => AsyncStorage.getItem("completedQuestionTutorial").then((val) => setCompletedQuestionTutorial(JSON.parse(val) || false))
      // double check each of them, to avoid blips
      checkQT().catch((e) => checkQT())
      let checkAT = () => AsyncStorage.getItem("completedAnswerTutorial").then((val) => setCompletedAnswerTutorial(JSON.parse(val) || false))
      checkAT().catch((e) => checkAT())

      // load last answered question so we make sure not to re-ask them it
      const lastQParsed = await loadLastQ()

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
            Alert.alert("The app will not function without these permissions. Please go into settings and correct, or reload the app")
          }
        } catch (err) {
          console.warn(err);
        }
      }
    }
    asyncFun()
  }, [])

  // TODO this might cause issues when user is setting up permissions on android
  // listen to when app is sent to background+foreground to reload stacks appropriately
  React.useEffect(() => {
    // clear the last one (we had trouble using remove() so we do it the old way)
    AppState.removeEventListener("change", appStateListener.current)
    // setup reload when put in background
    appStateListener.current = nextAppState => {
      // check if app has come to foreground
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // if the top stack is showing the "NoAnswers" card, reload both stacks
        // if the top stack is showing a Question or Answer card and we know a new Question is availalble, reload both stacks
        if (topStack === 1) {
          if (cards1[0] === 'None') reloadStacks()
          else {
            const asyncFun = async () => {
              if (await hasNewQuestion()) reloadStacks()
            }
            asyncFun()
          }
        }
        else {
          if (cards2[0] === 'None') reloadStacks()
          else {
            const asyncFun = async () => {
              if (await hasNewQuestion()) reloadStacks()
            }
            asyncFun()
          }
        }
      }
      appState.current = nextAppState;
    };
    AppState.addEventListener("change", appStateListener.current)
    // cleanup on unmount
    return () => {
      AppState.removeEventListener("change", appStateListener.current)
    };
  // we need to keep these variables updated
  }, [topStack, cards1, cards2, question])

  // error handling done in component
  const submitAnswerAndProceed = async (data:string) => {
    // see recorder docs regarding rn-fetch-blob if you have trouble uploading file
    const result = await submitAnswer({
      audio_data: data,
      question_uuid: question.key
    })
    await AsyncStorage.setItem("lastQuestionAnswered", JSON.stringify(question))
    if (topStack === 1) swiper1.current.swipeRight()
    else swiper2.current.swipeRight()
  }

  const rateAnswerAndAnimate = async (card: AnswerCard, rating: number) => {
    await rateAnswer(card.id, rating)
    // fail silently
  }

  const reportAnswerAndAnimate = async (card: AnswerCard) => {
    await reportAnswer(card.id)
    // fail silently
  }

  // on initial load we need to pass through the recently loaded question because it may not have been set yet
  // on subsequent full-app reloads we need to pass through a "previousQuestionForced" to get around react not updating
  // the question state variable yet
  const loadStack = async (stack:number, loadedQuestion?:APIQuestion, previousQuestionForced?: APIQuestion) => {
    try {
      // set up the next question if the user hasn't already answered it
      const newQ = await getQuestion()
      const curQuestion = previousQuestionForced || question
      if (curQuestion.key !== newQ.key && loadedQuestion?.key !== newQ.key) {
        setQuestion(newQ)
        // we completely override the card stack since we only allow 1 card per stack right now
        const cardSetterCallback = (oldCards) => ["Question"]
        if (stack === 1) setCards1(cardSetterCallback)
        else setCards2(cardSetterCallback)
        return newQ
      }
      // no new question, so instead set up a new answer for the user to hear
      const newA = await getAnswer(loadedQuestion?.key || curQuestion.key)
      // TODO check if we actually got an answer. if we didn't, set the next card to be "None"
      // we completely override the card stack since we only allow 1 card per stack right now
      const cardSetterCallback = (oldCards) => [{
        id: newA.answer_uuid,
        data: newA.audio_data
      }]
      if (stack === 1) setCards1(cardSetterCallback)
      else setCards2(cardSetterCallback)
      return loadedQuestion
    }
    catch (e) {
      // loading is critical. if it fails, do a hard reload
      Alert.alert("Failed to load card. Please contact support if this keeps happening.")
      reloadStacks()
      throw new Error("Cannnot load single, reloading all")
    }
  }

  // risky function. It expects the caller to reloadStacks on true because of the possible exception
  const hasNewQuestion = async () => {
    try {
      const newQ = await getQuestion()
      return question.key !== newQ.key
    }
    catch (e) {
      Alert.alert("Failed to load question. Please contact support if this keeps happening.")
      return true
    }
  }

  // when toggling top stack, we clear the completed (top) stack, move the bottom stack on top, initiate a load for the empty stack, and disable swipes because questions dont use them and answers need to unlock them
  // One exception is if we need to reload both stacks because the card just swiped was a "NoAnswers" card. In that case we swap the positions of the stacks, clear them, reload both, and disable swipes
  const toggleTopStack = (reloadBothStacks: boolean) => {
    setDisableSwipes(true)
    if (topStack === 1) {
      setTopStack(2)
    }
    else {
      setTopStack(1)
    }
    if (reloadBothStacks) {
      reloadStacks()
    }
    else if (topStack === 1) {
      setCards1([])
      loadStack(1)
    }
    else {
      setCards2([])
      loadStack(2)
    }
  }

  // clears both stacks + question and loads them just like how the app loads when its first opened
  const reloadStacks = () => {
    // we use setImmediate as a replacement of nextTick. We're trying to avoid collision with other state setters
    setImmediate(async () => {
      setCards1([])
      setCards2([])
      setTopStack(1)
      clearTempAnswerList()
      // check to see if they previously answered this question
      const lastQParsed = await loadLastQ()
      // reload stacks
      loadStack(1, lastQParsed, {}).then((questionPassthrough) => loadStack(2, questionPassthrough, {}))
    })
  }

  const onCompleteQuestionTutorial = () => {
    setCompletedQuestionTutorial(true)
    AsyncStorage.setItem("completedQuestionTutorial", JSON.stringify(true)).catch((e) => {
      // try again
      AsyncStorage.setItem("completedQuestionTutorial", JSON.stringify(true))
    })
  }

  const onCompleteAnswerTutorial = () => {
    setCompletedAnswerTutorial(true)
    AsyncStorage.setItem("completedAnswerTutorial", JSON.stringify(true)).catch((e) => {
      // try again
      AsyncStorage.setItem("completedAnswerTutorial", JSON.stringify(true))
    })
  }

  // since Swiper doesnt support adding more cards to an existing stack, we use 2 here to simulate a single stack. Whichever one is "beneath" gets refreshed and reloaded while the one "on top" is displayed
  // once the one on top runs out, the one below is shown and they swap jobs
  return (
    <SafeAreaProvider>
      <SizeContext.Provider value={screenSize}>
        <View style={styles.loadingScreen}>
          {/* For now we dont set `animating` based on `loadStack`. If we need performance boost, maybe try that */}
          <ActivityIndicator size="large" color="#A9C5F2" />
        </View>
        {cards1.length ?
          <Swiper
            cards={cards1}
            renderCard={(card) => {
              if (card === 'Question') {
                return <Question submitAnswerAndProceed={submitAnswerAndProceed} question={question} completedTutorial={completedQuestionTutorial} onCompleteTutorial={onCompleteQuestionTutorial} onError={reloadStacks} />
              }
              else if (card === 'None') {
                return <NoAnswers setDisableSwipes={setDisableSwipes} />
              }
              else {
                return <Answer setDisableSwipes={setDisableSwipes} answerAudioData={card.data} id={card.id} question={question} completedTutorial={completedAnswerTutorial} onCompleteTutorial={onCompleteAnswerTutorial} onApprove={() => swiper1.current.swipeRight()} onDisapprove={() => swiper1.current.swipeLeft()} onPass={() => swiper1.current.swipeTop()} onReport={() => swiper1.current.swipeBottom()} onError={reloadStacks} />
              }
            }}
            onSwiped={() => {}}
            onSwipedRight={(index) => {
              if (cards1[index] !== "Question" && cards1[index] !== "None") rateAnswerAndAnimate(cards1[index], 1)
            }}
            onSwipedLeft={(index) => {
              if (cards1[index] !== "Question" && cards1[index] !== "None") rateAnswerAndAnimate(cards1[index], -1)
            }}
            onSwipedTop={(index) => {
              if (cards1[index] !== "Question" && cards1[index] !== "None") rateAnswerAndAnimate(cards1[index], 0)
            }}
            onSwipedBottom={(index) => {
              if (cards1[index] !== "Question" && cards1[index] !== "None") reportAnswerAndAnimate(cards1[index])
            }}
            onSwipedAll={() => {
              toggleTopStack(cards1[0] === "None" && cards2[0] === "None")
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
              if (val === "Question" || val === "None") return val
              else return val.id
            }}
            containerStyle={{
              top: 0,
              left: 0,  
              position: 'absolute',
              elevation: topStack === 1 ? 1 : 0,
              zIndex: topStack === 1 ? 10 : 0
            }}
            childProps={[completedQuestionTutorial, completedAnswerTutorial]}
          />
          : null
        }
        {cards2.length ?
          <Swiper
            cards={cards2}
            renderCard={(card) => {
              if (card === 'Question') {
                return <Question submitAnswerAndProceed={submitAnswerAndProceed} question={question} completedTutorial={completedQuestionTutorial} onCompleteTutorial={onCompleteQuestionTutorial} onError={reloadStacks} />
              }
              else if (card === 'None') {
                return <NoAnswers setDisableSwipes={setDisableSwipes} />
              }
              else {
                return <Answer setDisableSwipes={setDisableSwipes} answerAudioData={card.data} id={card.id} question={question} completedTutorial={completedAnswerTutorial} onCompleteTutorial={onCompleteAnswerTutorial} onApprove={() => swiper2.current.swipeRight()} onDisapprove={() => swiper2.current.swipeLeft()} onPass={() => swiper2.current.swipeTop()} onReport={() => swiper2.current.swipeBottom()} onError={reloadStacks} />
              }
            }}
            onSwiped={() => {}}
            onSwipedRight={(index) => {
              if (cards2[index] !== "Question" && cards2[index] !== "None") rateAnswerAndAnimate(cards2[index], 1)
            }}
            onSwipedLeft={(index) => {
              if (cards2[index] !== "Question" && cards2[index] !== "None") rateAnswerAndAnimate(cards2[index], -1)
            }}
            onSwipedTop={(index) => {
              if (cards2[index] !== "Question" && cards2[index] !== "None") rateAnswerAndAnimate(cards2[index], 0)
            }}
            onSwipedBottom={(index) => {
              if (cards2[index] !== "Question" && cards2[index] !== "None") reportAnswerAndAnimate(cards2[index])
            }}
            onSwipedAll={() => {
              toggleTopStack(cards1[0] === "None" && cards2[0] === "None")
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
              if (val === "Question" || val === "None") return val
              else return val.id
            }}
            containerStyle={{
              top: 0,
              left: 0,
              position: 'absolute',
              elevation: topStack === 2 ? 1 : 0,
              zIndex: topStack === 2 ? 10 : 0
            }}
            childProps={[completedQuestionTutorial, completedAnswerTutorial]}
          />
          : null
        }
      </SizeContext.Provider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingScreen: {
    elevation: -1,
    zIndex: -1,
    position: 'absolute',
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default App;
