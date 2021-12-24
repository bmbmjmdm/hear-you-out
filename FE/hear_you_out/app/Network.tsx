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
    body: await AsyncStorage.getItem("answerList") || JSON.stringify([])
  });
  return await result.json()
}

// TODO when you rate an answer, add it to our async storage list
// TODO delete saved list at some point