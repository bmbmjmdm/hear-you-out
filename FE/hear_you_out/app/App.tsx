
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
import { APIQuestion, getAnswer, getQuestion, rateAnswer, submitAnswer, reportAnswer, clearTempAnswerList, getAnswerStats, APIAnswerStats, login } from './Network'
import AsyncStorage from '@react-native-async-storage/async-storage';
import NoAnswers from './NoAnswers'
import { ScreenSize, SizeContext } from './helpers'
import * as amplitude from '@amplitude/analytics-react-native';

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
  const [grantedPermissions, setGrantedPermissions] = React.useState(false)
  const [cards1, setCards1] = React.useState<Array<string | object>>([])
  const [cards2, setCards2] = React.useState<Array<string | object>>([])
  const [topStack, setTopStack] = React.useState(1)
  const [question, setQuestion] = React.useState<APIQuestion>({})
  const [stats, setStats] = React.useState<APIAnswerStats>({})
  const [completedQuestionTutorial, setCompletedQuestionTutorial ] = React.useState(false)
  const [completedAnswerTutorial, setCompletedAnswerTutorial ] = React.useState(false)
  const [completedFlagTutorial, setCompletedFlagTutorial ] = React.useState(false)
  const [completedShareTutorial, setCompletedShareTutorial ] = React.useState(false)
  const appState = React.useRef(AppState.currentState);
  const appStateListener = React.useRef<Function | null>(null);

  const animatedSwipeRight1 = React.useRef(false)
  const animatedSwipeLeft1 = React.useRef(false)
  const answer1 = React.useRef(null)
  const animatedSwipeRight2 = React.useRef(false)
  const animatedSwipeLeft2 = React.useRef(false)
  const answer2 = React.useRef(null)

  // set up analytics
  React.useEffect(() => {
    amplitude.init("xxxxxxxxxxxxxxxxxxxxx")
  }, [])

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
        amplitude.track('ERROR: Failed to load users last question in loadLastQ', {error: e.message});
        // we can't do anything else, move on without a loading question
        Alert.alert("Unsure if previously answered. Please contact support if this keeps happening.")
      }
    }
  }

  React.useEffect(() => {
    const asyncFun = async () => {
      // login so we can authenticate all future calls
      try {
        await login();
      }
      catch (e) {
        amplitude.track('ERROR: Failed to login', {error: e.message});
        Alert.alert("Failed to login. Please restart the app and check your internet connection.")
        return;
      }

      // check if theyve gone through the tutorials or not. do this async since we have to load the stacks anyway
      let checkQT = () => AsyncStorage.getItem("completedQuestionTutorial").then((val) => setCompletedQuestionTutorial(JSON.parse(val) || false))
      // double check each of them, to avoid blips
      checkQT().catch((e) => checkQT())
      let checkAT = () => AsyncStorage.getItem("completedAnswerTutorial").then((val) => setCompletedAnswerTutorial(JSON.parse(val) || false))
      checkAT().catch((e) => checkAT())
      let checkFT = () => AsyncStorage.getItem("completedFlagTutorial").then((val) => setCompletedFlagTutorial(JSON.parse(val) || false))
      checkFT().catch((e) => checkFT())
      let checkST = () => AsyncStorage.getItem("completedShareTutorial").then((val) => setCompletedShareTutorial(JSON.parse(val) || false))
      checkST().catch((e) => checkST())

      // load last answered question so we make sure not to re-ask them it
      const lastQParsed = await loadLastQ()

      // load initial stacks
      loadStack(1, lastQParsed).then((questionPassthrough) => loadStack(2, questionPassthrough))

      // ask for permissions on android
      if (Platform.OS === 'android') {
        const permissionsRequest = async () => {
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
              setGrantedPermissions(true)
            } else {
              amplitude.track('ERROR: User refused to give permission', {error: "User error", writeExternal: grants['android.permission.WRITE_EXTERNAL_STORAGE'], readExternal: grants['android.permission.READ_EXTERNAL_STORAGE'], recordAudio: grants['android.permission.RECORD_AUDIO']});
              Alert.alert(
                "Insufficient Permissions",
                "This app will not function without all permissions. We use these permissions to store and play audio data for your answer and others'. We do not access other files on your device.",
                [
                  {
                    text: "Retry",
                    onPress: permissionsRequest
                  }
                ]
              )
            }
          } catch (err) {
            amplitude.track('ERROR: Failed to finish permissions', {error: err.message});
            setGrantedPermissions(true)
            Alert.alert(
              "Permissions Error",
              "We don't know what just happened. If the app fails to function, try closing it completely and re-launching it."
            )
          }
        }
        permissionsRequest();
      }
    }
    asyncFun()
  }, [])

  // TODO this might cause issues when user is setting up permissions on android
  // listen to when app is sent to background+foreground to reload stacks appropriately
  React.useEffect(() => {
    // clear the last one (we had trouble using remove() so we do it the old way)
    if (appStateListener.current) AppState.removeEventListener("change", appStateListener.current)
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
      else if (nextAppState === "background") {
        amplitude.track('App sent to background or quit');
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
    amplitude.track('Submitted question recording');
    // see recorder docs regarding rn-fetch-blob if you have trouble uploading file
    await submitAnswer({
      audio_data: data,
      question_uuid: question.key
    })
    await AsyncStorage.setItem("lastQuestionAnswered", JSON.stringify(question))
    if (topStack === 1) swiper1.current?.swipeRight()
    else swiper2.current?.swipeRight()
  }

  const rateAnswerAndAnimate = async (card: AnswerCard, rating: number) => {
    amplitude.track('Rated answer: ' + (rating > 0 ? "upvote" : rating < 0 ? "downvote" : "skipped"));
    await rateAnswer(card.id, rating)
    // fail silently
  }

  const reportAnswerAndAnimate = async (card: AnswerCard) => {
    amplitude.track('Reported answer');
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
        const oldAnswerStats = await getAnswerStats()
        setStats(oldAnswerStats)
        setQuestion(newQ)
        // we completely override the card stack since we only allow 1 card per stack right now
        const cardSetterCallback = (oldCards) => ["Question"]
        if (stack === 1) setCards1(cardSetterCallback)
        else setCards2(cardSetterCallback)
        return newQ
      }
      // no new question, so instead set up a new answer for the user to hear
      const newA = await getAnswer(loadedQuestion?.key || curQuestion.key)
      let cardSetterCallback
      if (newA.no_answers) {
        // we were not given an answer
        // we completely override the card stack since we only allow 1 card per stack right now
        cardSetterCallback = (oldCards) => ["None"]
      }
      else {
        // we have an answer
        // we completely override the card stack since we only allow 1 card per stack right now
        cardSetterCallback = (oldCards) => [{
          id: newA.answer_uuid,
          data: newA.audio_data,
          questionText: newQ.text
        }]
      }
      if (stack === 1) setCards1(cardSetterCallback)
      else setCards2(cardSetterCallback)
      return loadedQuestion
    }
    catch (e) {
      amplitude.track('ERROR: Failed to finish loadStack', {error: e.message});
      // loading is critical. if it fails, do a hard reload
      Alert.alert("Failed to load card. Please check your internet connection or contact support", undefined, [{
        text: "Reload",
        onPress: reloadStacks
      }], {
        cancelable: false
      })
      throw new Error("Cannot load single, reloading all")
    }
  }

  // risky function. It expects the caller to reloadStacks on true because of the possible exception
  const hasNewQuestion = async () => {
    try {
      const newQ = await getQuestion()
      return question.key !== newQ.key
    }
    catch (e) {
      amplitude.track('Failed to load question in hasNewQuestion', {error: e.message});
      Alert.alert("Failed to load question. Please check your internet connection or contact support")
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
      setDisableSwipes(true)
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

  const onCompleteFlagTutorial = () => {
    setCompletedFlagTutorial(true)
    AsyncStorage.setItem("completedFlagTutorial", JSON.stringify(true)).catch((e) => {
      // try again
      AsyncStorage.setItem("completedFlagTutorial", JSON.stringify(true))
    })
  }

  const onCompleteShareTutorial = () => {
    setCompletedShareTutorial(true)
    AsyncStorage.setItem("completedShareTutorial", JSON.stringify(true)).catch((e) => {
      // try again
      AsyncStorage.setItem("completedShareTutorial", JSON.stringify(true))
    })
  }

  // since Swiper doesnt support adding more cards to an existing stack, we use 2 here to simulate a single stack. Whichever one is "beneath" gets refreshed and reloaded while the one "on top" is displayed
  // once the one on top runs out, the one below is shown and they swap jobs
  return (
    <SafeAreaProvider>
      <SizeContext.Provider value={screenSize}>
        <View style={styles.loadingScreen}>
          {/* For now we dont set `animating` based on `loadStack`. If we need performance boost, maybe try that */}
          <ActivityIndicator size="large" color="#F0F3F5" />
        </View>
        {cards1.length && grantedPermissions ?
          <Swiper
            onSwiping={(x, y) => {
              if (x > 50 && !animatedSwipeRight1.current) {
                animatedSwipeRight1.current = true
                answer1.current?.animateSwipeRight()
              }
              else if (x < 50) {
                animatedSwipeRight1.current = false
              }
              if (x < -50 && !animatedSwipeLeft1.current) {
                animatedSwipeLeft1.current = true
                answer1.current?.animateSwipeLeft()
              }
              else if (x > -50) {
                animatedSwipeLeft1.current = false
              }
            }}
            cards={cards1}
            renderCard={(card) => {
              if (card === 'Question') {
                return (
                  <Question
                    submitAnswerAndProceed={submitAnswerAndProceed}
                    question={question}
                    stats={stats}
                    completedTutorial={completedQuestionTutorial}
                    onCompleteTutorial={onCompleteQuestionTutorial}
                    onError={reloadStacks}
                    isShown={topStack === 1}
                  />
                )
              }
              else if (card === 'None') {
                return <NoAnswers setDisableSwipes={setDisableSwipes} isShown={topStack === 1} />
              }
              else {
                return (
                  <Answer
                    setDisableSwipes={setDisableSwipes}
                    answerAudioData={card.data}
                    id={card.id}
                    question={card.questionText}
                    completedTutorial={completedAnswerTutorial}
                    onCompleteTutorial={onCompleteAnswerTutorial}
                    onApprove={() => swiper1.current.swipeRight()}
                    onDisapprove={() => swiper1.current.swipeLeft()}
                    onPass={() => swiper1.current.swipeTop()}
                    onReport={() => swiper1.current.swipeBottom()}
                    onError={reloadStacks}
                    isShown={topStack === 1}
                    completedFlagTutorial={completedFlagTutorial}
                    completedShareTutorial={completedShareTutorial}
                    onCompleteFlagTutorial={onCompleteFlagTutorial}
                    onCompleteShareTutorial={onCompleteShareTutorial}
                    ref={answer1}

                  />
                )
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
        {cards2.length && grantedPermissions ?
          <Swiper
            onSwiping={(x, y) => {
              if (x > 50 && !animatedSwipeRight2.current) {
                animatedSwipeRight2.current = true
                answer2.current?.animateSwipeRight()
              }
              else if (x < 50) {
                animatedSwipeRight2.current = false
              }
              if (x < -50 && !animatedSwipeLeft2.current) {
                animatedSwipeLeft2.current = true
                answer2.current?.animateSwipeLeft()
              }
              else if (x > -50) {
                animatedSwipeLeft2.current = false
              }
            }}
            cards={cards2}
            renderCard={(card) => {
              if (card === 'Question') {
                return (
                  <Question
                    submitAnswerAndProceed={submitAnswerAndProceed}
                    question={question}
                    stats={stats}
                    completedTutorial={completedQuestionTutorial}
                    onCompleteTutorial={onCompleteQuestionTutorial}
                    onError={reloadStacks}
                    isShown={topStack === 2}
                  />
                )
              }
              else if (card === 'None') {
                return <NoAnswers setDisableSwipes={setDisableSwipes} isShown={topStack === 2} />
              }
              else {
                return (
                  <Answer
                    setDisableSwipes={setDisableSwipes}
                    answerAudioData={card.data}
                    id={card.id}
                    question={card.questionText}
                    completedTutorial={completedAnswerTutorial}
                    onCompleteTutorial={onCompleteAnswerTutorial}
                    onApprove={() => swiper2.current.swipeRight()}
                    onDisapprove={() => swiper2.current.swipeLeft()}
                    onPass={() => swiper2.current.swipeTop()}
                    onReport={() => swiper2.current.swipeBottom()}
                    onError={reloadStacks}
                    isShown={topStack === 2}
                    completedFlagTutorial={completedFlagTutorial}
                    completedShareTutorial={completedShareTutorial}
                    onCompleteFlagTutorial={onCompleteFlagTutorial}
                    onCompleteShareTutorial={onCompleteShareTutorial}
                    ref={answer2}
                  />
                )
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
    justifyContent: 'center',
    backgroundColor: '#191919'
  }
});

export default App;
