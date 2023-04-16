import pandas as pd
from sklearn.manifold import TSNE
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
import pinecone
import csv
from local_secrets import setupKeys

# Connect to the Pinecone index
setupKeys()
index = pinecone.Index(index_name="test")

# Retrieve data from the index
data = index.query(vector=[0] * 1536, top_k=100, include_metadata=True, include_values=True)

# Convert the data into a list of dictionaries
rows = []
for item in data.matches:
    row = {"answer_id": item.id, "embedding": item.values, "category": item.metadata['category'], "Score": item.score}
    rows.append(row)

# Write the data to a CSV file
with open("output.csv", "w") as csvfile:
    fieldnames = ["answer_id", "embedding", "category", "Score"]
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

    writer.writeheader()
    for row in rows:
        writer.writerow(row)


# Load the embeddings
datafile_path = "output.csv"
df = pd.read_csv(datafile_path)

# Convert to a list of lists of floats
matrix = np.array(df.embedding.apply(eval).to_list())

# Create a t-SNE model and transform the data
tsne = TSNE(n_components=2, perplexity=5, random_state=42, init='random', learning_rate=200)
vis_dims = tsne.fit_transform(matrix)
vis_dims.shape

colors = ["red", "darkorange", "gold", "turquoise", "darkgreen"]
x = [x for x,y in vis_dims]
y = [y for x,y in vis_dims]
color_indices = df.Score.values - 1
colormap = matplotlib.colors.ListedColormap(colors)
plt.scatter(x, y, c=color_indices, cmap=colormap, alpha=0.3)

# when the user clicks on a point, print the text
def get_closest_point(x, y):
    min_dist = 1000000
    min_index = -1
    for i, (x1, y1) in enumerate(vis_dims):
        dist = (x1 - x)**2 + (y1 - y)**2
        if dist < min_dist:
            min_dist = dist
            min_index = i
    return min_index
def on_click(event):
    if event.inaxes:
        print(df.category[get_closest_point(event.xdata, event.ydata)])
plt.connect('button_press_event', on_click)

plt.show()