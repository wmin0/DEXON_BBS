import {htmlEntities, getUrlParameter, getTitle, getUser, getParseText} from './utils.js'
import {ABIBBS, ABIBBSExt, BBSContract, BBSExtContract, web3js, BBS, BBSExt, initDexon, loginDexon, newReply} from './dexon.js'

let tx = ''
let account = ''

let isShowReply = false, isShowReplyType = false

const activeDexonRender = (_account) => {
  account = _account

  if (account){
    // show User
    $("#bbs-login").hide()
    $("#bbs-register").hide()
    $("#bbs-user").show()

    // only show reply btn at first time
    if (!$("#reply-user").text()) $("#reply-btn").show()
  }
  else{
    // show Login/Register
    $("#bbs-login").show()
    $("#bbs-register").show()
    $("#bbs-user").hide()

    // hide reply btn
    $("#reply-btn").hide()
  }

  $("#bbs-user").text(getUser(account))
  $("#reply-user").text(getUser(account))
}

const showReplyType = async () => {
  $('#reply-btn').hide()

  const voted = await BBSExt.methods.voted(account, tx).call()
  if (voted) return showReply(0)

  $('#reply-type0').show()
  $('#reply-type1').show()
  $('#reply-type2').show()

  isShowReplyType = true
}

const hideReplyTypeBtn = () => {
  $('#reply-type0').hide()
  $('#reply-type1').hide()
  $('#reply-type2').hide()

  isShowReplyType = false
}

const showReply = (type) => {
  hideReplyTypeBtn()

  $('#reply').show()
  $('#reply-send').show()
  $('#reply-cancel').show()

  const typeColor = {
    0: '#fff',
    1: '#ff6',
    2: '#f66',
  }
  $("#reply-type").css('color',typeColor[type])
  $("#reply-type").val(type)

  $("html").stop().animate({scrollTop:$('#reply').position().top}, 500, 'swing')
  $("#reply-content").focus()

  isShowReply = true
  
}

const hideReply = () => {
  hideReplyTypeBtn()

  $("#reply").hide()
  $('#reply-send').hide()
  $('#reply-cancel').hide()
  $('#reply-btn').show()
  $("#reply-content").val('')

  isShowReply = false
}

const main = async () => {
  tx = getUrlParameter('tx')

  if (!tx) return

  if (!tx.match(/^0x[a-fA-F0-9]{64}$/g)) return

  initDexon(activeDexonRender)

  $('#bbs-login').click(() => { loginDexon(activeDexonRender) })

  $('#reply-btn').click(() => { showReplyType() })
  $('#reply-type0').click(() => { showReply(0) })
  $('#reply-type1').click(() => { showReply(1) })
  $('#reply-type2').click(() => { showReply(2) })
  $('#reply-cancel').click(() => { hideReply() })
  $('#reply-send').click(() => { newReply(tx.substr(0,66), $("#reply-type").val(), $("#reply-content").val()) })

  $("#reply-content").blur(() => { $("#reply-content").val(getParseText($("#reply-content").val(), 56)) })

  keyboardHook()

  const transaction = await web3js.eth.getTransaction(tx)

  // check transaction to address is bbs contract 
  if ( transaction.to.toLowerCase() !== BBSExtContract.toLowerCase() &&
       transaction.to.toLowerCase() !== BBSContract.toLowerCase() &&
       transaction.to.toLowerCase() !== '0x9b985Ef27464CF25561f0046352E03a09d2C2e0C'.toLowerCase()
  ) return

  const content = web3js.utils.hexToUtf8('0x' + transaction.input.slice(138))
  const title = getTitle(content.substr(0, 42))
  const contentDisplay = title.match ? content.slice(title.title.length+2) : content
  // const contentNormalized = contentDisplay.trim()
    // .replace(/\n\s*?\n+/g, '\n\n')

  document.title = title.title + ' - Gossiping - DEXON BBS'
  $('#main-content-author').text(getUser(transaction.from))
  // $('#main-content-author').attr('href', 'https://dexonscan.app/address/'+transaction.from)
  $('#main-content-title').text(title.title)
  $('#main-content-content').text(contentDisplay)
  web3js.eth.getBlock(transaction.blockNumber).then(block => {
    $('#main-content-date').text((''+new Date(block.timestamp)).substr(0,24))
  })
  $('#main-content-href').attr('href', window.location.href)
  $('#main-content-href').text(window.location.href)
  $('#main-content-from').text('@'+transaction.blockNumber)
  $('#main-content-from').attr('href', 'https://dexonscan.app/transaction/'+tx)

  const events = await BBSExt.getPastEvents({fromBlock : '990000'})

  events.slice().filter((event) => {return tx == event.returnValues.origin})
  .map(async (event) => {
    const transaction = await web3js.eth.getTransaction(event.transactionHash)
    const block = await web3js.eth.getBlock(event.blockNumber)
    return [event.returnValues.content, transaction.from, block.timestamp, event.returnValues.vote]
  })
  .reduce( async (n,p) => {
    await n
    displayReply(...await p)
  }, Promise.resolve())
}

const keyboardHook = () => {
  const ctrlKey = 17, returnCode = 13

  $(document).keyup((e) => {
    if (!isShowReply && !isShowReplyType && e.keyCode == 'X'.charCodeAt()) {
      showReplyType()
    }
    else if (!isShowReply && isShowReplyType && '1'.charCodeAt() <= e.keyCode && e.keyCode <= '3'.charCodeAt()) {
      if ( e.key == '1' ) showReply(1)
      else if ( e.key == '2' ) showReply(2)
      else if ( e.key == '3' ) showReply(0)
    }
    else if ( isShowReply && !isShowReplyType && e.ctrlKey && e.keyCode == returnCode) {
      if ($("#reply-content").val().length > 0)
        newReply(tx, $("#reply-type").val(), $("#reply-content").val())
      else
        hideReply()
    }
  })
}

const displayReply = (content, from, timestamp, vote) => {
  content = htmlEntities(content)
  const voteName = ["→", "推", "噓"]
  const elem = $('<div class="push"></div>')
  const date = new Date(timestamp)
  const formatDate = (date.getMonth()+1)+'/'+(''+date.getDate()).padStart(2, '0')+' '+(''+date.getHours()).padStart(2, '0')+':'+(''+date.getMinutes()).padStart(2, '0')

  elem.html(`<span class="${vote != 1 ? 'f1 ' : ''}hl push-tag">${voteName[vote]} </span><a class="f3 hl push-userid" target="_blank" href="${'https://dexonscan.app/address/'+from}">${getUser(from)}</a><span class="f3 push-content">: ${content}</span><span class="push-ipdatetime">${formatDate}</span>`)
  $('#main-content.bbs-screen.bbs-content').append(elem)
}

$(main)


