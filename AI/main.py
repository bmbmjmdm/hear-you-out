#!/usr/bin/env python3
import openai
import pinecone
from local_secrets import setupKeys
import uuid

# Keys are set up in secrets.py
setupKeys()
#openai.api_key = 'xxxxxxxxxxxxxxxxxxx'
#pinecone.init(api_key="xxxxxxxxxxxxxxxxx")

# Create Pinecone index
dimension = 1536
metric = "cosine"
pod_type = "p1"
ANSWERS_TABLE = "test"
if ANSWERS_TABLE not in pinecone.list_indexes():
  print("creating vector db")
  pinecone.create_index(ANSWERS_TABLE,
                        dimension=dimension,
                        metric=metric,
                        pod_type=pod_type)
  
# base vector to subtract from all other vectors. purposely leave out 7 to increase influence of political leaning
base = openai.Embedding.create(
  input=["1 Party\n2 Philosophy\n3 Societal Ideology\n4 Philosophical Approach\n5 Ethical Theory\n6 Social Structure"], model="text-embedding-ada-002")["data"][0]["embedding"]

# Helper function to get embedding from text
def get_embedding(text):
  result = openai.Embedding.create(
    input=[text], model="text-embedding-ada-002")["data"][0]["embedding"]
  return [result[i] - base[i] for i in range(len(result))]

# Helper function to get related answers from Pinecone index
def get_context(query: str, index: str, n: int):
  cur_embedding = get_embedding(query)
  index = pinecone.Index(index_name=index)
  results = index.query(cur_embedding, top_k=n, include_metadata=True)
  sorted_results = sorted(results.matches, key=lambda x: x.score, reverse=True)
  return [(str(item.metadata['category'])) for item in sorted_results]

# Helper function to add answer to Pinecone index
def add_answer_to_index(answer: str, answer_id: str, transcript: str, index: str):
  index = pinecone.Index(index_name=index)
  index.upsert([(answer_id, get_embedding(answer), {"category": answer, "transcript": transcript})])


def get_categorized_answer(transcript: str):
  response = openai.ChatCompletion.create(model='gpt-3.5-turbo',
                                          messages=[
                                            {"role": "user",
                                              "content": f"Here is a quote: {transcript}\n Based on this quote, list these things: 1 What political party do you think this person belongs to? 2 What philosophical school of thought best encapsulates this view? Consider politics/philosophy from all over the world and all of history. If you cannot find one that fits the user, make one up with a concise name. The answers should be no more than 3 words. NEVER respond to 1 with 'None' or 'Unknown'; you MUST give a political party, even if there's not enough information; make one up if you have to. After those 2, for the next 5 categories, choose which word/phrase from each list best describes the quote. 3 Individualism, Collectivism, Nationalism, Globalism 4 Materialism, Idealism, Rationalism, Empiricism 5 Utilitarianism, Deontology, Determinism, Free Will 6 Equality, Hierarchy, Liberty, Authority 7 Progressive, Conservative, Radical, Centrist. The format should be a concise list from 1-7 wtih no empty lines."
                                            }
                                          ],
                                          temperature=0,
                                          max_tokens=75,)
  return response.choices[0].message.content

# Transcribe audio file
#audio_file= open("record.wav", "rb")
#response = openai.Audio.transcribe(model='whisper-1',
#                                    file=audio_file,
#                                    language='en')
#transcript= response.text.strip()


transcriptList = [
  "I'm voting for Trump because abortion is murder. I don't really like him, he's kindof a sexist and is too crass, but ultimately he supports Christian values and that's what's most important.",
  "I'm voting for Biden because we need to protect LGBTQ+ rights. I feel like it's forced, though, because Biden has a history of being homophobic. I'm not sure if I can trust him. Ultimately, though, I'm voting for Biden because I don't want to see what horrible things Trump will do to the LGBTQ+ community.",
  "I'm voting for whoever can give me a bigger tax break. I fucking love money, like yeah the world's going to shit but who cares? As long as I can look out for me and my family, that's all that matters, and honestly I think that's a perfectly rightious thing to do.",
  "I'm not voting for either Biden or Trump because neither one of them will do what's needed to save the environment. I would honestly love it if they were both killed off and we got some new options. Both parties need to step up their game, or we need a new party. And fast, climate change is only getting worse and soon enough none of this will matter.",
  "I want to vote for someone that will help stop or reverse climate change, but it doesn't really feel like I have an option. Trump is obviously not gonna do it, he's definitely making things worse, but Biden isn't gonna do much either. He'll do just enough to get re-elected but ultimately rely on republicans to shoot down any major legislation. I'll probably end up voting for Biden though, whatever.",
  "I don't know who I'm going to vote for. On the one hand, Trump is clearly a fascist, conman, etc who is only using the position of office to further benefit himself and his cronies. He's promoting racism and xenophobia to control people through fear and hate, and is pushing through changes that will harm the environment, strip wealth from the middle and lower class and funnel it to the rich, and strip voting rights away from millions. On the other hand, Biden is a career politician with a history in war mongering, anti LGBTQ rights, and clearly is just a schill for the democratic doners. He said so himself that nothing would fundementally change under his administration and I believe him. He doesn't want to reform the corrupt and broken system we have now, he just wants to placate the liberals, which has been the democratic playbook for years now and is why we're in the situation of choosing between 2 evils.",
  "I'll probably vote for Trump. He reduced my taxes last year and he gets things done. Definitely not voting for that communist schill Biden.",
  "I'm voting for turd sandwitch as a write-in protest vote.",
  "I've mulled over politics in the last 4 years under Trump. I think the democrats and republicans can come together and work on solving the problems of today if we can get past identity politics. On the right you have the Christians, and on the left you have the LGBTQ+. I don't think a third party is viable because whoever votes for it will give the election to the other candidate. I think we need to focus on improving our leaders and keeping them more accountable. I think Biden will at least try to work with the Republicans, whereas Trump will not.",
  "I like Trump because he tells it like it is. Fuck those fags and dykes. They try taking away our guns and then cry cause they can't molest a kid in the bathroom. Fucking pussies and pedophiles, all of them.",
  "I'm voting for Biden because he has America's interest at the top of mind. He's well connected and knows how to work within government, and he isn't a racist, xenophobic monster like Trump is. He may not give the leftists everything they want, but they need to grow up and realize that they need to compromise and work together with their fellow citizens to make good, progressive change.",
  "Voting is over rated. Burn it all down, I say. That's the only way to get anyone to listen to you. It's a dog-eat-dog world and the only thing people listen to is whatever directly affects them. Politicians especially won't listen until you're breaking down their doors and dragging them out to hang.",
  "FRP should have majority in Norwegian government because they will protect Norwegian jobs, they won't restrict air travel, they won't increase taxes, they won't make you pay for roads and parking, and they will protect our borders."
  "We need more young people to vote for KRF because this country is losing all christian values. Gays should not be allowed to marry, and abortion must be illegal. "
]

for transcript in transcriptList:
    print("***** TRANSCRIPT *****")
    print(transcript)

    categorized_answer = get_categorized_answer(transcript)
    print("***** CATEGORIES *****")
    print(categorized_answer)

    context = get_context(categorized_answer, ANSWERS_TABLE, 20)
    print("***** SIMILAR *****")
    print(context)

    add_answer_to_index(categorized_answer, str(uuid.uuid4()), transcript, ANSWERS_TABLE)
    print("***** ADDED *****")


######## STATISTICS ############
# Retrieve data from the index and print statistics on distances
indexToTest = pinecone.Index(index_name=ANSWERS_TABLE)
data = indexToTest.query(vector=[0] * 1536, top_k=100, include_metadata=True, include_values=True)
totalItems = 0
totalRep = 0
totalRepScore = 0
totalRepClose = 0
totalRepFar = 0
totalDem = 0
totalDemScore = 0
totalDemClose = 0
totalDemFar = 0
totalDemSearched = 0
totalRepSearched = 0
for item in data.matches:
    totalItems = totalItems + 1
    # also lookup closest vectors for each one to see what its democrat-republican distance is
    lookingFor = 'None'
    if 'Democrat' in item.metadata['category']:
        lookingFor = 'Republican'
    elif 'Republican' in item.metadata['category']:
        lookingFor = 'Democrat'
    if lookingFor != 'None':
        # we know item is a democrat/republican one, now we search the context
        results = indexToTest.query(item.values, top_k=999, include_metadata=True)
        sorted_results = sorted(results.matches, key=lambda x: x.score, reverse=True)
        furthest = 0
        found = False
        cur = 0
        for context in sorted_results:
            cur = cur + 1
            if lookingFor in context.metadata['category']:
                if lookingFor == 'Democrat':
                    totalDem = totalDem + 1
                    totalDemScore = totalDemScore + context.score
                elif lookingFor == 'Republican':
                    totalRep = totalRep + 1
                    totalRepScore = totalRepScore + context.score
                # keep track of the furthers lookingFor we've seen
                furthest = cur
                if not found:
                    # keep the first lookingFor we see
                    found = True
                    if lookingFor == 'Democrat':
                        totalDemClose = totalDemClose + cur
                    elif lookingFor == 'Republican':
                        totalRepClose = totalRepClose + cur
        if lookingFor == 'Democrat':
            totalDemFar = totalDemFar + furthest
            totalDemSearched = totalDemSearched + 1
        elif lookingFor == 'Republican':
            totalRepFar = totalRepFar + furthest
            totalRepSearched = totalRepSearched + 1

print(f"average democrat score: {str(totalDemScore/totalDem)}")
print(f"average democrat close: {str(totalDemClose/totalDemSearched)}")
print(f"average democrat far: {str(totalDemFar/totalDemSearched)}")
print(f"average republicn score: {str(totalRepScore/totalRep)}")
print(f"average republicn close: {str(totalRepClose/totalRepSearched)}")
print(f"average republicn far: {str(totalRepFar/totalRepSearched)}")
print("****sanity check")
print(f"totalRepSearched: {str(totalRepSearched)}")
print(f"totalDemSearched: {str(totalDemSearched)}")

# last stats benchmark
# Republican Perspective: 
# average democrat score: 0.5900893346666666
# average democrat index closest: 8.75
# average democrat index furthest: 12
# Democrat Perspective:
# average republican score: 0.5900893346666666
# average republican index closest: 6.66
# average republican index furthest: 10