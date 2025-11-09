from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello, World!'

# Using Flask development server - won't scale on Railway!
if __name__ == '__main__':
    app.run(debug=True, port=5000)
