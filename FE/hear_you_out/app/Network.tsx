import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

const baseURL = 'http://192.168.1.136:8080/api/'
//const baseURL = 'https://hearyouout.deta.dev/
let access_token = "";
let id:null|string = "";

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
  id = await AsyncStorage.getItem("id")
  // check to see if we're registered yet, if not, register us with the device id
  if (!id) {
    const registerResult = await fetchWithRetry(`${baseURL}auth/register`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_id: DeviceInfo.getDeviceId(),
      }),
    });
    const registerJson = await registerResult.json()
    id = registerJson.device_id
    if (id) await AsyncStorage.setItem("id", id)
  }

  // if regristration failed, abort
  if (!id) throw new Error("No id returned from register")

  const result = await fetchWithRetry(`${baseURL}auth/login?device_id=${id}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });
  const json = await result.json()
  if (json.access_token) access_token = json.access_token
  else throw new Error("No access token returned from login")
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
  return json
}

export type APIAnswerStats = {
  key: string,
  num_agrees: number,
  num_disagrees: number,
  num_abstains: number,
  num_serves: number
}

export const getAnswerStats = async(): Promise<APIAnswerStats> => {
  // todo given the new be....
  /*
  const oldAnswer = await AsyncStorage.getItem("oldAnswer")
  const result = await fetchWithRetry(`${baseURL}answers/stats?answer_id=${oldAnswer}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      authorization: `Bearer ${access_token}`,
    },
  });
  return await result.json()*/
  return {
    key: "1",
    num_agrees: 1,
    num_disagrees: 1,
    num_abstains: 1,
    num_serves: 1
  }
}

export type APIAnswer = {
  audio_data: string,
  question_uuid: string
}

export type APIAnswerId = {
  answer_id: string
}

export const submitAnswer = async (answer: APIAnswer): Promise<APIAnswerId> => {
  tempAnswerList = []
  // submit answer
  const result = await fetchWithRetry(`${baseURL}answer`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
  },
    body: JSON.stringify({
      ...answer,
      user_id: id,
    })
  });
  const json = await result.json()
  if (json.detail) {
    throw new Error(json.detail)
  }
  // overwrite previously seen answers since we're on a new question
  await AsyncStorage.setItem("answerList", JSON.stringify([json.answer_id]))
  await AsyncStorage.setItem("oldAnswer", JSON.stringify(json.answer_id))
  return json
}

export type APIOthersAnswer = {
  audio_data: string,
  answer_uuid: string,
  no_answers: boolean
}

// this temporary answer list is used to store answers loaded but not rated. When we fetch new answers, we need to check both lists
let tempAnswerList = []

export const clearTempAnswerList = () => {
  tempAnswerList = []
}

export const getAnswer = async (questionId: string): Promise<APIOthersAnswer> => {
  // construct our previously seen answer list from our permanant list and temporary one
  let list: Array<string> = JSON.parse(await AsyncStorage.getItem("answerList")) || []
  list = list.concat(tempAnswerList)
  // fetch based on total list
  const result = await fetchWithRetry(`${baseURL}answers?ids=${JSON.stringify(list)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${access_token}`,
    }
  });
  // update temporary list of seen answers
  const json = await result.json()
  if (json.detail) {
    throw new Error(json.detail)
  }
  if (json[0].answer_uuid) tempAnswerList.push(json[0].answer_uuid)
  return json[0]
}

export const rateAnswer = async (answerId: string, rating: number): Promise<void> => {
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
}

export const reportAnswer = async (answerId: string): Promise<void> => {
  const phoneId = "" // TODO decide if we want to send phoneId, which we can get from react-native-device-info
  const result = await fetchWithRetry(`${baseURL}flagAnswer?answer_uuid=${answerId}&phone_id=${phoneId}`, {
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
}

