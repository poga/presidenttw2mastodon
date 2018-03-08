const request = require('request-promise-native')
const argv = require('minimist')(process.argv.slice(2))
const db = require('level')(argv.db || './level.db')

const host = argv.host
const token = argv.token

async function main () {
  let resp = await request.get('http://www.president.gov.tw/Handler/GetPresidentOrder.ashx')
  resp = JSON.parse(resp)

  for (var j = 0; j < resp.length; j++) {
    let section = resp[j]

    if (section.Title === '公布法律、預決算、條約' || section.Title === '任免官員') {
      for (var i = 0; i < section.PresidentOrderS.length; i++) {
        let order = section.PresidentOrderS[i]
        let orderID = `${order.PublicDate}-${order.Title}`

        try {
          // check if the order is already posted
          await db.get(orderID)
        } catch (err) {
          if (!err.notFound) continue

          let text = order.ContentText.replace(/<p>/gi, '').replace(/<\/p>/gi, '').replace(/<br>/gi, '')

          let pdf = text.match(/<a href="(.+)">/)[1]
          text = text.replace(/<a href="(.+)">\[pdf\]<\/a>/, '')
          text = text + '\n' + 'http://www.president.gov.tw' + pdf

          await request({
            method: 'POST',
            uri: `${host}/api/v1/statuses`,
            formData: {
              status: [order.Title, text].join('\n'),
              visibility: 'public'
            },
            qs: {
              access_token: token
            }
          })

          await db.put(orderID, true)
        }
      }
    }
  }
}

main()

process.on('unhandledRejection', up => { throw up })
