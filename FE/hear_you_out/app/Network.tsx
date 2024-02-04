import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import analytics from '@react-native-firebase/analytics';
import messaging from '@react-native-firebase/messaging';

const baseURL = 'http://192.168.1.136:8080/api/'
//const baseURL = 'https://hearyouout.deta.dev/

let access_token = "";
let id:string = ""; 

const fetchWithRetry = async (url, options) => {
  try {
    const result = await fetch(url, options)
    return result
  }
  catch (e) {
    const result = await fetch(url, options)
    return result
  }
}

export const login = async (): Promise<void> => {
  const deviceId = await DeviceInfo.getUniqueId();
  await messaging().registerDeviceForRemoteMessages();
  const token = await messaging().getToken();
  console.log("logging in")
  id = await AsyncStorage.getItem("id") || ""
  // check to see if we're registered yet, if not, register us with the device id
  if (!id) {
    console.log("registering")
    const registerResult = await fetchWithRetry(`${baseURL}auth/register`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_id: deviceId,
        firebase_token: token,
      }),
    });
    const registerJson = await registerResult.json()
    const newId = registerJson.id
    if (newId) await AsyncStorage.setItem("id", newId)
    // if regristration failed, record it but continue
    else {
      analytics().logEvent('registration_failed', { details: "User likely reinstalled app"});
    }
  }

  const result = await fetchWithRetry(`${baseURL}auth/login?device_id=${deviceId}&firebase_token=${token}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });
  const json = await result.json()
  // we need access token and user id to successfully make calls
  if (json.access_token) access_token = json.access_token
  else throw new Error("No access token returned from login")
  if (json.user_id) id = json.user_id
  else throw new Error("No id returned from login")
  await unSubscribeToNewAnswers()
  console.log("done logging in")
}


export type APIQuestion = {
  checklist: Array<string>,
  key: string,
  text: string
}
export const getQuestion = async (): Promise<APIQuestion> => {
  console.log("getting question")
  const result = await fetchWithRetry(`${baseURL}question`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      authorization: `Bearer ${access_token}`,
    },
  });
  const json = await result.json()
  if (json.detail) {
    throw new Error(json.detail)
  }
  console.log("returning question")
  return {
    ...json,
    key: json.id,
  }
}

export type APIAnswerStats = {
  id: string,
  views_count: number,
}

export const getAnswerStats = async(): Promise<APIAnswerStats> => {
  console.log("getting stats")
  const oldAnswer = await AsyncStorage.getItem("oldAnswer")
  const result = await fetchWithRetry(`${baseURL}answers/views?ids=${oldAnswer}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      authorization: `Bearer ${access_token}`,
    }
  });
  console.log("returning stats")
  return await result.json()[0]
}

export type APIAnswer = {
  audio_data: string,
  question_uuid: string
}

export type APIAnswerId = {
  answer_id: string
}

export const submitAnswer = async (answer: APIAnswer): Promise<APIAnswerId> => {
  console.log("submitting answer")
  // submit answer
  const result = await fetchWithRetry(`${baseURL}answer`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      is_active: true,
      question_id: answer.question_uuid,
      views: 0,
      audio_data: answer.audio_data,
      user_id: id,
    })
  });
  const json = await result.json()
  if (json.detail) {
    throw new Error(JSON.stringify(json.detail))
  }
  
  await AsyncStorage.setItem("answerList", JSON.stringify([json.id]))
  await AsyncStorage.setItem("oldAnswer", JSON.stringify(json.id))
  console.log("done submitting answer")
  return json
}

export type APIOthersAnswer = {
  audio_data: string,
  answer_uuid: string,
  no_answers: boolean
}

// this temporary answer list is used to store answers loaded but not rated. When we fetch new answers, we need to check both lists
let tempAnswerList:string[] = []

export const clearTempAnswerList = () => {
  tempAnswerList = []
}

export const getAnswer = async (questionId: string): Promise<APIOthersAnswer> => {
  console.log("getting answer")
  // construct our previously seen answer list from our permanant list and temporary one
  let list: Array<string> = JSON.parse(await AsyncStorage.getItem("answerList")) || []
  list = list.concat(tempAnswerList)
  // reduce the list into multiple query params
  const seenAnswersQuery = list.reduce((acc, cur) => acc + `&seen_answers_ids=${cur}`, "")
  // yuo can also include a "sorting" query param and set it to "random" or "top", but by default it'll 50/50 between the two, which is ok
  // fetch based on total list
  const result = await fetchWithRetry(`${baseURL}answers?limit=1${seenAnswersQuery}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${access_token}`,
    }
  });

  if (result.status === 204) {
    console.log("returning -no- answer")
    return {
      no_answers: true
    }
  }
  
  const json = await result.json()
  if (json.detail) {
    throw new Error(json.detail)
  }

  const returnedAnswer = {
    answer_uuid: json[0].id as string,
    audio_data: json[0].audio_data as string,
    no_answers: false
  }

  // update temporary list of seen answers
  tempAnswerList.push(returnedAnswer.answer_uuid)
  console.log("returning answer")
  return returnedAnswer
}

export const rateAnswer = async (answerId: string, rating: number): Promise<void> => {
  console.log("rating answer")
  // update our permanant list of seen answers
  const oldPreviouslyRatedAnswers =  JSON.parse(await AsyncStorage.getItem("answerList"))
  oldPreviouslyRatedAnswers.push(answerId)
  const newPreviouslyRatedAnswers = JSON.stringify(oldPreviouslyRatedAnswers)
  await AsyncStorage.setItem("answerList", newPreviouslyRatedAnswers)
  
  // post rating
  const result = await fetchWithRetry(`${baseURL}vote`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: id,
      answer_id: answerId,
      vote: rating
    }),
    headers: {
      authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    }
  });
  console.log("done rating answer")
}

export const reportAnswer = async (answerId: string): Promise<void> => {
  console.log("reporting answer")
  const result = await fetchWithRetry(`${baseURL}flag`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: id,
      answer_id: answerId,
      reason: ""
    }),
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${access_token}`,
    }
  });
  console.log("done reporting answer")
}

export const subscribeToNewAnswers = async (): Promise<void> => {
  console.log("subscribing to new answers")
  const didSubscribe = await AsyncStorage.getItem("subscribed")
  if (didSubscribe) return;
  const result = await fetchWithRetry(`${baseURL}subscribe/new_answers`, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${access_token}`,
    }
  });
  if (result.status === 200) {
    await AsyncStorage.setItem("subscribed", "true")
  }
  console.log("done subscribing")
}

export const unSubscribeToNewAnswers = async (): Promise<void> => {
  console.log("UNsubscribing to new answers")
  const didSubscribe = await AsyncStorage.getItem("subscribed")
  if (!didSubscribe) return;
  const result = await fetchWithRetry(`${baseURL}unsubscribe/new_answers`, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${access_token}`,
    }
  });
  if (result.status === 200) {
    await AsyncStorage.removeItem("subscribed")
  }
  console.log("done UNsubscribing")
}