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
  // overwrite previously rated answers since we're on a new question
  await AsyncStorage.setItem("answerList", JSON.stringify([]))
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

export const getAnswer = async (questionId: string): Promise<APIOthersAnswer> => {
  const result = await fetch(`https://hearyouout.deta.dev/getAnswer?question_uuid=${questionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    // our answer list is already stringified
    body: await AsyncStorage.getItem("answerList")
  });
  return await result.json()
}

export const rateAnswer = async (answerId: string, rating: string): Promise<APIOthersAnswer> => {
  // update our list of rated answers
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
  return await result.json()
}
