const functions = require("firebase-functions");
// const {CloudTasksClient} = require("@google-cloud/tasks");
const admin = require("firebase-admin");

admin.initializeApp(functions.config().firebase);

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.auctionSetStatusInfo = functions.region("asia-northeast1").pubsub.schedule("* * * * *")
    .onRun((context)=>{
      admin.database().ref("auction_informations").once("value", (snapshot) => {
        const auctionInformations = snapshot.val();
        const currentTime = Math.floor(Date.now() / 1000);
        const auctionFinish = {};
        const auctionInprogess = {};
        const auctionOpen = {};

        if (auctionInformations) {
          for (const auctionId in auctionInformations) {
            if (currentTime > auctionInformations[auctionId].finish_time) {
              auctionFinish[auctionId] = auctionInformations[auctionId];
              admin.database().ref("auction_histories").child(auctionId).once("value", (snapshot) => {
                const auctionHistory = snapshot.val();
                for (const fishId in auctionHistory) {
                  if (Object.prototype.hasOwnProperty.call(auctionHistory, fishId)) {
                    const userWinner = auctionHistory[fishId].winner.user_id; // get user winner from aution.fish_id.winner
                    // const auctionId = 1;
                    // update success for user
                    admin.database().ref("users").child(userWinner).once("value", (data) =>{
                      const user = data.val();
                      let currentWinner = {};
                      if (user.list_success_auctions && user.list_success_auctions[auctionId] && user.list_success_auctions[auctionId][fishId]) {
                        currentWinner = user.list_success_auctions[auctionId][fishId];
                      }

                      if (!Object.prototype.hasOwnProperty.call(currentWinner, userWinner)) {
                        currentWinner[userWinner] = true;
                        admin.database().ref("users").child(userWinner).child("list_success_auctions").child(auctionId).child(fishId).set(currentWinner);
                      }
                    });
                    // update winner history
                    admin.database().ref("winner_histories").child(auctionId).once("value", (data) => {
                      const auctionWinner = data.val();

                      const participantsId = auctionHistory[fishId].winner.participant_id;
                      const bidValue = auctionHistory[fishId].winner.bid_value;
                      const userId = auctionHistory[fishId].winner.user_id;

                      if (!auctionWinner) {
                        const auctionWinnerHistory = {};
                        auctionWinnerHistory.start_time = auctionInformations[auctionId].start_time;
                        auctionWinnerHistory.finish_time = auctionInformations[auctionId].finish_time;
                        const winnerParticipants = {};
                        winnerParticipants[participantsId] = fishId;
                        winnerParticipants[participantsId][fishId] = {bid_value: bidValue, user_id: userId};

                        auctionWinnerHistory.winner_participants = winnerParticipants;

                        admin.database().ref("winner_histories").child(auctionId).set(auctionWinnerHistory);
                      } else {
                        admin.database().ref("winner_histories").child(auctionId).child("winner_participants").child(participantsId).child(fishId).set(
                            {
                              bid_value: bidValue,
                              user_id: userId,
                            }
                        );
                      }
                    });

                    // update list bidding for uer
                    const finalBid = auctionHistory[fishId].final_bid; // get user list bidding
                    for (const userId in finalBid) {
                      if (Object.prototype.hasOwnProperty.call(finalBid, userId)) {
                        const participantId = finalBid[userId].participant_id;
                        if (userId != participantId) {
                          admin.database().ref("users").child(participantId).child("list_bidding_auctions").child(auctionId).child(fishId).child(userId).remove();
                        }
                        admin.database().ref("users").child(userId).child("list_bidding_auctions").child(auctionId).child(fishId).child(userId).remove();
                      }
                    }
                  }
                }
              });
              // update fish is finished auction
              const listFish = auctionInformations[auctionId].list_fishes;
              for (const fishId in listFish) {
                if (Object.prototype.hasOwnProperty.call(listFish, fishId)) {
                  admin.database().ref("fishes").child(fishId).child("is_auction_finished").set(true);
                }
              }
            } else if (currentTime < auctionInformations[auctionId].start_time) auctionOpen[auctionId] = auctionInformations[auctionId];
            else if (currentTime >= auctionInformations[auctionId].start_time && currentTime <= auctionInformations[auctionId].finish_time) {
              auctionInprogess[auctionId] = auctionInformations[auctionId];
            }
          }

          admin.database().ref("auctions")
              .child("open_auctions").set(auctionOpen);
          admin.database().ref("auctions")
              .child("inprogress_auctions").set(auctionInprogess);
          admin.database().ref("auctions")
              .child("finish_auctions").set(auctionFinish);
        } else {
          console.log("Empty auction Informations");
        }
      });
      return "";
    });
exports.removeAuthUserTest = functions.region("asia-northeast1").https.onCall((data, context) => {
  admin
      .auth()
      .listUsers(1000)
      .then((listUsersResult) => {
        const listUid = [];
        listUsersResult.users.forEach((userRecord) => {
          const uid = userRecord.toJSON().uid;
          listUid.push(uid);
        });

        admin.auth().deleteUsers(listUid)
            .then(function() {
              console.log("Successfully deleted user");
            })
            .catch(function(error) {
              console.log("Error deleting user:", error);
            });
      })
      .catch((error) => {
        console.log("Error listing users:", error);
      });
});

exports.auctionRemoveMediaStorage = functions.region("asia-northeast1").pubsub.schedule("* * * * *")
    .onRun((context)=>{
      const bucket = admin.storage().bucket("absolute-dev01.appspot.com");

      admin.database().ref("auctions").child("finish_auctions").once("value", (snapshot) => {
        const auctionInformations = snapshot.val();
        // functions.logger.log("Successfully auctionInformations:", auctionInformations);
        const currentTime = Math.floor(Date.now() / 1000);
        if (auctionInformations) {
          for (const auctionId in auctionInformations) {
            if (Object.prototype.hasOwnProperty.call(auctionInformations, auctionId)) {
              // functions.logger.log("Successfully auctionInformations finish_time:", auctionInformations[auctionId].finish_time);
              const auctionFinishTime = auctionInformations[auctionId].finish_time;
              const diffTime = Math.abs(currentTime - auctionFinishTime);
              const diffDays = Math.ceil(diffTime / ( 60 * 60 * 24));
              if (diffDays >= 90) {
                // functions.logger.log("Successfully auctionInformations diffDays:", diffDays);
                const listFish = auctionInformations[auctionId].list_fishes;
                for (const fishId in listFish) {
                  if (Object.prototype.hasOwnProperty.call(listFish, fishId)) {
                    admin.database().ref("media").child(fishId).once("value", (data) => {
                      const media = data.val();
                      if (media) {
                        const lsitImages = media._fileNames;
                        // functions.logger.log("Successfully deleted lsitImages:", lsitImages);
                        if (lsitImages) {
                          lsitImages.forEach( (fileName) => {
                            const filePath = `images/${fileName}`;
                            const file = bucket.file(filePath);
                            functions.logger.log("Successfully deleted file:", file);
                            file.delete().then(() => {
                              functions.logger.log(`Successfully deleted photo with name: ${fileName}`);
                            });
                          });
                        }

                        const movies = media._videoNames;
                        if (movies) {
                          movies.forEach( (fileName) => {
                            const filePath = `movies/${fileName}`;
                            const file = bucket.file(filePath);

                            file.delete().then(() => {
                              functions.logger.log(`Successfully deleted movies with name: ${fileName}`);
                            });
                          });
                        }
                      }

                      admin.database().ref("media").child(fishId).remove();
                    });
                  }
                }
              }
            }
          }
        }
      });
      return "";
    });
// exports.simpleDbFunction = functions.database.ref("/auction_informations/{auctionId}")
//     .onWrite((change, context) => {
//       // Only edit data when it is first created.
//       // if (change.before.exists()) {
//       //   return null;
//       // }
//       // // Exit when the data is deleted.
//       // if (!change.after.exists()) {
//       //   return null;
//       // }
//       // Grab the current value of what was written to the Realtime Database.
//       const original = change.after.val();
//       console.log("Uppercasing", context.params.auctionId, original.start_time);
//       // const uppercase = original.toUpperCase();
//       // You must return a Promise when performing asynchronous tasks inside a Functions such as
//       // writing to the Firebase Realtime Database.
//       // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
//       // return change.after.ref.parent.child('uppercase').set(uppercase);

//       const client = new CloudTasksClient();

//       const serviceAccountEmail = "ctsoft-task-queue-appspot-gser@absolute-dev01.iam.gserviceaccount.com";
//       const project = "absolute-dev01";
//       const queue = "auctionupdate";
//       const location = "asia-northeast1";
//       const url =
//           "https://us-central1-absolute-dev01.cloudfunctions.net/receivedData";

//       const payload = {
//         foo: "bar",
//         key: "value",
//       };

//       const formattedParent = client.queuePath(project, location, queue);

//       const task = {
//         httpRequest: {
//           httpMethod: "POST",
//           url: url,
//           body: Buffer.from(JSON.stringify(payload)).toString("base64"),
//           headers: {
//             "Content-Type": "application/json",
//           },
//           oidcToken: {
//             serviceAccountEmail,
//           },
//         },
//       };
//       task.scheduleTime = {
//         seconds: 300,
//       };
//       console.log("Sending task:");
//       console.log(task);
//       const request = {
//         parent: formattedParent,
//         task: task,
//       };

//       client.createTask(request, (data)=>{
//         console.log(`Created task ${data}`);
//       });
//     });


