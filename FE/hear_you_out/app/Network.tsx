import AsyncStorage from '@react-native-async-storage/async-storage';

export type APIQuestion = {
  category: string,
  key: string,
  text: string
}

export const getQuestion = async (): Promise<APIQuestion> => {
  const result = await fetch('https://hearyouout.deta.dev/getQuestion', {
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
  // overwrite previously seen answers since we're on a new question
  await AsyncStorage.setItem("answerList", JSON.stringify([]))
  tempAnswerList = []
  // submit answer
  const result = await fetch('https://hearyouout.deta.dev/submitAnswer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(answer)
  });
  return await result.json()
}

export type APIOthersAnswer = {
  audio_data: string,
  answer_uuid: string
}

// this temporary answer list is used to store answers loaded but not rated. When we fetch new answers, we need to check both lists
let tempAnswerList = []

export const getAnswer = async (questionId: string): Promise<APIOthersAnswer> => {
  // construct our previously seen answer list from our permanant list and temporary one
  let list: Array<string> = JSON.parse(await AsyncStorage.getItem("answerList"))
  list = list.concat(tempAnswerList)
  // fetch based on total list
  const result = await fetch(`https://hearyouout.deta.dev/getAnswer?question_uuid=${questionId}`, {
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
  const result = await fetch(`https://hearyouout.deta.dev/rateAnswer?answer_uuid=${answerId}&agreement=${rating}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: newPreviouslyRatedAnswers
  });
}
