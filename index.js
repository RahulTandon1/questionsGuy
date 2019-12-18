let questionIsBeingMade = false
let confirmMessageSent = false
var questionObj;
var approvedUserArr
const fs = require('fs') // for reading the help message
const Discord = require('discord.js');
const client = new Discord.Client();
const mongoose = require('mongoose')

/* ----------------------------------------------------------------------------------------------------- */
mongoose.connect(`mongodb+srv://kidnikid:${process.env.pass}@espicehuntingpractice-qwqid.mongodb.net/Questions?retryWrites=true&w=majority`, 
{ useNewUrlParser: true, 
  useFindAndModify: false, 
  useUnifiedTopology: true })
.then(() => console.log('connected to db'))
.catch(err => console.log('error while connecting to db', err))

const questionSchema = new mongoose.Schema({
  type: String, 
  question: String, 
  answer: String, 
})

const Question = mongoose.model('Question', questionSchema)

async function saveQuestion(q){
  try {
    tempQuestion = new Question({
      type: q.type,
      question: q.question, 
      answer: q.answer, 
    })
    let result = await tempQuestion.save()
    console.log(result)
    return result
  }
  catch (err) {
    console.log('error while saving document to db', err)
  }
}

async function getQuestions(type, lim){
  try {
    lim = Number(lim)
    let result = await Question
    .find({type: type})
    .sort({date: 1})
    .limit(lim)
    .select({question:1, type:1, answer:1})
    return result

  }
  catch (err) {
    console.log('error while getting documents from db', err)
  }
}
/* ----------------------------------------------------------------------------------------------------- */

// the indicator used to signal that the message is to be interpreted by the bot
const indicator = {
  qInit: '$makeQ',
  quit: '$quit',
  q: '$question',
  a: '$answer',
  type: '$type',
  save: '$saveQ',
  yes: '$yes', 
  help: '$help', 
  getQs: '$getQs'
}

let helpMessage = fs.readFileSync('helpMessage.txt', 'utf8') // reads help message from file

/* ----------------------------------------------------------------------------------------------------- */

// returns an array of authorised user's that can add questions
function getAuthorisedUsers(client) {
  // defines whose an authorised user in terms of Role
  authorisedUser = 'proguy' // currently only proguys allowed
  var arr = new Array() // the arr to be returned

  // client.guilds returns a collection of guilds which in turn are collections themselves
  // .array()[0] converts the collection to an array and returns it's first element i.e. first guild
  // in this case, there is only one guild so we're safe by hardcoding array()[0]
  let guild = client.guilds.array()[0] // returns a guild object (actual js object)
  
  // returns an array of role objects (actual js objects)
  let roles = (guild.roles.array()) 

  // iterating through each role
  roles.forEach( (roleObj) => {
    // checking if role's the same as the one authorised
    if (roleObj.name === authorisedUser){
      let members = roleObj.members.array() // returns an array of guild member objects

      // iterating through Authorised GuildMembers
      members.forEach( (member) => {
        arr.push(member.id) // appends the Authorised Member's Id to the array to be returned
      })
    } 
  })
  return arr
}
/* ----------------------------------------------------------------------------------------------------- */

// runs after bot loads and is ready
client.on('ready', () => {
  approvedUserArr = getAuthorisedUsers(client)
  console.log('List of IDs of approved question creators:', approvedUserArr)
})

/* ----------------------------------------------------------------------------------------------------- */

// check if a question is being made
function checkQuestionBeingMade (message) {
  let indicatorPresent = message.content.startsWith(indicator.qInit)
  let authorIsApproved = approvedUserArr.includes(message.author.id)
  if (Boolean(indicatorPresent && authorIsApproved)) {
    questionIsBeingMade = true
    message.channel.send('Question making process initiated')
    message.channel.send(`Please use the ${indicator.q} indicator to give the question. Type ${indicator.quit} indicator to exit`)
    questionObj = new Object()
  }
  // else remains false
}

/* ----------------------------------------------------------------------------------------------------- */

function printTillNow(channel, obj){
  obj = JSON.stringify(obj)
  channel.send(`Till now, object is ${obj}`)
}

/* ----------------------------------------------------------------------------------------------------- */

// runs when a message is received
client.on('message', (message) => {
  let channel = message.channel  
  if (message.content.startsWith(indicator.help)) {
    channel.send(helpMessage)
  }
  else if(message.content.startsWith(indicator.getQs)) {
    req = message.content.substring(indicator.getQs.length).trim()
    type = null
    if (req.includes('quiz')) {
      lim = Number(req.replace('quiz', '').trim())
      type = 'quiz'
    }
    else if(req.includes('cross')) {
      lim = Number(req.replace('cross', '').trim())
      type = 'cross'
    }
    let counter = 1
    getQuestions(type, lim)
    .then((res) => {
      res.forEach((q) => {
        channel.send(`Q ${counter}:`)
        channel.send(`Type: ${q.type}`)
        channel.send(`Question: ${q.question}`)
        channel.send(`Answer: ${q.answer}`)
        counter++
      })
    })
    .catch( err => {
      channel.send('Err occured while retrieving users')
    })
  }
  else if (questionIsBeingMade === false && message.content.startsWith('$')) {
    checkQuestionBeingMade(message)
  }
  else if (message.content.startsWith(indicator.save)) {
    channel.send(`Are you sure that you want to save this question => ${JSON.stringify(questionObj)}`)
    confirmMessageSent = true
  }
  else if (message.content.startsWith(indicator.yes)) {
    saveQuestion(questionObj)
    .then((res) => {channel.send(`Question stored in db ${JSON.stringify(res)}`)})
    .catch(err => {
      console.log(err)
      channel.send('Problem while storing to db')
    questionObj = null
    })
    confirmMessageSent =  false;
  }
  else if (message.content.startsWith('$')) {
    var indexToStartFrom // a temporary variable

    switch (true) {
      // checks if user asked to quit
      case message.content.startsWith(indicator.quit):
        questionIsBeingMade = false
        questionObj = new Object() // refreshes the question object for later use
        channel.send('quitted')
        break;

      // checks if user provided type
        case message.content.startsWith(indicator.type):
        indexToStartFrom = indicator.type.length
        questionObj.type = message.content.substring(indexToStartFrom).trim()
        break;

      // checks if user provided question 
      case message.content.startsWith(indicator.q):
        indexToStartFrom = indicator.q.length
        questionObj.question = message.content.substring(indexToStartFrom).trim()
        break;
      
        // checks if user provided answer
      case message.content.startsWith(indicator.a):
        indexToStartFrom = indicator.a.length
        questionObj.answer = message.content.substring(indexToStartFrom).trim()
        break;
    }
    if (questionIsBeingMade) printTillNow(channel, questionObj) // if user has not quit
    else if (questionObj === null) channel.send('No question currently formed')
    else channel.send('Question Making Process Terminated')
  }
})

/* ----------------------------------------------------------------------------------------------------- */

client.login(process.env.token)
