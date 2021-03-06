import AsyncStorage from '@react-native-async-storage/async-storage';

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

export type APIQuestion = {
  checklist: Array<string>,
  key: string,
  text: string
}

export const getQuestion = async (): Promise<APIQuestion> => {
  const result = await fetchWithRetry('https://hearyouout.deta.dev/getQuestion', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  return await result.json()
}

export type APIAnswerStats = {
  key: string,
  num_agrees: number,
  num_disagrees: number,
  num_abstains: number,
  num_serves: number
}

export const getAnswerStats = async(): Promise<APIAnswerStats> => {
  const oldAnswer = await AsyncStorage.getItem("oldAnswer")
  const result = await fetchWithRetry(`https://hearyouout.deta.dev/getAnswerStats?answer_uuid=${oldAnswer}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  return await result.json()
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
  const result = await fetchWithRetry('https://hearyouout.deta.dev/submitAnswer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(answer)
  });
  const json = await result.json()
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
  const result = await fetchWithRetry(`https://hearyouout.deta.dev/getAnswer?question_uuid=${questionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(list)
  });
  // update temporary list of seen answers
  const res = await result.json()
  if (res.answer_uuid) tempAnswerList.push(res.answer_uuid)
  return res
}

export const rateAnswer = async (answerId: string, rating: number): Promise<void> => {
  // update our permanant list of seen answers
  const oldPreviouslyRatedAnswers =  JSON.parse(await AsyncStorage.getItem("answerList"))
  oldPreviouslyRatedAnswers.push(answerId)
  const newPreviouslyRatedAnswers = JSON.stringify(oldPreviouslyRatedAnswers)
  await AsyncStorage.setItem("answerList", newPreviouslyRatedAnswers)
  
  // post rating
  const result = await fetchWithRetry(`https://hearyouout.deta.dev/rateAnswer?answer_uuid=${answerId}&agreement=${rating}`, {
    method: 'POST',
  });
}

export const reportAnswer = async (answerId: string): Promise<void> => {
  const phoneId = "" // TODO decide if we want to send phoneId, which we can get from react-native-device-info
  const result = await fetchWithRetry(`https://hearyouout.deta.dev/flagAnswer?answer_uuid=${answerId}&phone_id=${phoneId}`, {
    method: 'POST',
  });
}

