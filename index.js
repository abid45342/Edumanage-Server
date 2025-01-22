const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const jwt = require('jsonwebtoken');
 
//mideware
app.use(cors());
app.use(express.json());



 

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uxfsb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const userCollection = client.db("EduManageDb").collection("users");
    const teacherRequestCollection = client.db("EduManageDb").collection("teacherRequests");
   
    const classCollection = client.db("EduManageDb").collection("classes");
    const enrollCollection = client.db("EduManageDb").collection("enrollClasses");
    const assignmentCollection = client.db("EduManageDb").collection("assignments");
    const submittionCollection = client.db("EduManageDb").collection("submitted");
    const feedbackCollection = client.db("EduManageDb").collection("feedback");
    

    // jwt releated api
    app.post('/jwt',async(req,res)=>{
        const user = req.body;
        const token = jwt.sign(user,process.env.ACCESS_SECRET_TOKEN,{expiresIn:'10h'});
        res.send({token});
      })


      const verifyToken = (req,res,next)=>{
          // console.log('inside verify token', req.headers.authorization);
        if(!req.headers.authorization)
          {
            return res.status(403).send({ message: 'forbidden access' });
          }
          const token = req.headers.authorization.split(' ')[1];
          // console.log(token)
        
         jwt.verify(token,process.env.ACCESS_SECRET_TOKEN,(error,decoded)=>{
          if(error){
            return res.status(409).send({message : 'forbidden access'})
          }
        
          req.decoded = decoded 
          next();
         })
      } 



      const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if (!isAdmin) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      } 

      const verifyTeacher = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'teacher';
        if (!isAdmin) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      } 


      const verifyStudent = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'student';
        if (!isAdmin) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      } 


 
    app.post('/users', async (req,res)=>{
        const user = req.body;
        const query = {email:user.email}
        const existingUser = await userCollection.findOne(query);
        if(existingUser){ 
          return res.send({message: 'user allready exist',insertedId:null})
        }
        const result = await userCollection.insertOne(user);
        res.send(result); 
    });

 
   
 
      app.get('/users', verifyToken, async (req, res) => {
        const search = req.query.search || ''; // Retrieve the search query parameter
        try {
          // Search query: Find users by name or email (case-insensitive)
          const query = {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
            ],
          };
      
          const result = await userCollection.find(query).toArray();
          res.status(200).send(result); // Send matching users
        } catch (error) {
          console.error('Error fetching users:', error);
          res.status(500).send({ error: 'Internal Server Error' });
        }
      });

      app.patch('/users/role/:id',verifyToken, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: 'admin'
          }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      })

      app.get('/usersH',async(req,res)=>{
        const result = await userCollection.find().toArray();
        res.send(result);
      })

      app.get('/classesH',async(req,res)=>{
        const result = await classCollection.find().toArray();
        res.send(result)
      });
      app.get('/enrollmentsH',async(req,res)=>{
        const result = await enrollCollection.find().toArray();
        res.send(result)
      });



      app.get('/popular-classes', async (req, res) => {
        try {
            // Aggregate to get the count of enrollments for each class
            const popularClasses = await enrollCollection.aggregate([
                {
                    $group: {
                        _id: "$classDetails._id", // Group by class ID
                        enrollmentCount: { $sum: 1 }, // 
                        classDetails: { $first: "$classDetails" } // Get the class details
                    }
                },
                {
                    $sort: { enrollmentCount: -1 } // Sort by highest enrollment count
                },
                { $limit: 6 } // Limit to top 6 most popular classes
            ]).toArray();
    
            // Return the popular classes with enrollment count
            res.send(popularClasses);
        } catch (err) {
            console.error(err);
            res.status(500).send('Error fetching popular classes');
        }
    });
    
    









      app.get('/users/role/:email',async(req,res)=>{
        const email = req.params.email;
        // console.log(email)
    
        const query = {email:email};
        const user = await userCollection.findOne(query);
        let role = '';
        if(user){
          role = user?.role ;
        }
        res.send({ role });
  
      })

      // payment intent
      app.post('/create-payment-intent',verifyToken,async(req,res)=>{
        const {price}=req.body;
        const amount = parseInt(price*100);
   
        const paymentIntent = await stripe.paymentIntents.create({
          amount:amount,
          currency:'usd',
          payment_method_types:['card'] 
        });
        console.log(amount)
        res.send({
          clientSecret : paymentIntent.client_secret
        })
      })






      
      app.post('/teacher-requests', verifyToken, async (req, res) => {
        const { email } = req.decoded; // Get email from decoded token
        const requestData = req.body; // Form data from frontend
        requestData.email = email;
        requestData.status = 'pending'; // Initial status
        requestData.createdAt = new Date(); // Timestamp
  
        const result = await teacherRequestCollection.insertOne(requestData);
        res.send(result);
      });


    //   app.get('/teacher-requests/:email', verifyToken, async (req, res) => {
    //     const email = req.params.email;
    //     // console.log(email);
    
    //     if (email !== req.decoded.email) {
    //         return res.status(403).send({ message: 'unauthorized access' });
    //     }
    
    //     try {
    //         const query = { email: email };
    //         const teacherRequests = await teacherRequestCollection.find(query).toArray();
    //         res.status(200).send(teacherRequests);
    //     } catch (error) {
    //         console.error('Error fetching teacher requests:', error);
    //         res.status(500).send({ error: 'Internal Server Error' });
    //     }
    // });
    app.get('/teacher-requests/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      console.log(email)
  
      if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'unauthorized access' });
      }
  
      try {
        console.log(email)
          const query = { email: email };
          const teacherRequests = await teacherRequestCollection.find(query).toArray();
  
          // Determine the status based on the first teacher request, if available
          console.log(teacherRequests)
         const status= teacherRequests[0].status;
         console.log(status)

  
          res.status(200).send({
              teacher: teacherRequests, // All teacher request data
              // Status of the teacher request
              status
          });
      } catch (error) {
          console.error('Error fetching teacher requests:', error);
          res.status(500).send({ error: 'Internal Server Error' });
      }
  });
  
  
  app.patch('/teacher-requests/resubmit/:email',verifyToken, async (req, res) => {
    const email = req.params.email;
    const reqdata = req.body;
    const filter = { email: email }; 
    console.log(reqdata);
  
    const updatedDoc = {
      $set: { ...reqdata } // Make sure to spread reqdata inside $set to update the fields correctly
    };
  
    const result = await teacherRequestCollection.updateOne(filter, updatedDoc);
    res.send(result);
  });
  
    app.get('/teacher',verifyToken,async(req,res)=>{
      const teacherRequests = await teacherRequestCollection.find().toArray();
      res.send(teacherRequests)

 
    })
    

    //////////////////


    app.patch('/teacher/update-status/:email',verifyToken, async(req,res)=>{
      const email = req.params.email;
      const { status } = req.body;
      const filter = { email: email };
      const updatedDoc = {
        $set: { status: status }
      };
      const result = await  teacherRequestCollection.updateOne(filter, updatedDoc);
      res.send(result);
 
    })   


app.patch('/updateRole/:email',verifyToken,async(req,res)=>{
  const {email}=req.params;
  const {role}= req.body;
  try {
    const result = await userCollection.updateOne(
      { email },
      { $set: { role } }
    );
    if (result.modifiedCount > 0) {
      res.status(200).json({ message: 'User role updated successfully!' });
    } else {
      res.status(404).json({ error: 'User not found or role unchanged!' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error updating user role!' });
  }
})



   
app.post('/addClass',async(req,res)=>{ 
  const classData = req.body;
  const result = await classCollection.insertOne(classData);
  res.send(result);

})
app.get('/getEnrollmentCount/:classId', async (req, res) => {
  const { classId } = req.params; // Extract classId from the URL parameter

  try {
    // Define the query to match the classId in your enrollment collection
    const query = { "classDetails._id": classId }; 

    // Query the enrollment collection for all matching documents
    const result = await enrollCollection.find(query).toArray();

    // Count the total number of enrollments
    const enrollmentCount = result.length;

    // Send the count as a response
    res.json({ count: enrollmentCount });
  } catch (error) {
    console.error('Error fetching enrollment count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



app.post('/addAssignment',async(req,res)=>{
  const id = req.params;
  const assignment = req.body;
  const result = await assignmentCollection.insertOne(assignment);
  res.send(result);

})
app.get('/getAssignment/:clsid',verifyToken, async (req, res) => {
  const  {clsid}  = req.params;
  console.log(clsid) 
  try {
    const result = await assignmentCollection.find({ classId: clsid }).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).send({ error: "Failed to fetch assignments" });
  }
}); 
app.get('/getAssignmentCount/:classId',verifyToken, async (req, res) => { 
  const { classId } = req.params; // Extract classId from the URL parameter

  try { 
    // Define the query to match assignments by classId
    const query = { classId:classId };

    // Query the assignments collection to find all matching documents
    const result = await assignmentCollection.find(query).toArray();

    // Count the total number of assignments
    const assignmentCount = result.length;


    // Send the count as a response
    res.json({ count: assignmentCount });
  } catch (error) {
    console.error('Error fetching assignment count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/getSubmissionCount/:classId',verifyToken, async (req, res) => {
  try {
    const classId = req.params.classId; // Extract classId from the request parameters
    const query = { classId }; // Filter submissions by classId 
    const submissionCount = await submittionCollection.countDocuments(query); // Count matching documents
    res.send({ count: submissionCount });
  } catch (error) {
    console.error('Error fetching submission count:', error);
    res.status(500).send({ error: 'Failed to fetch submission count' });
  }
});



app.post('/submitAssignment',verifyToken,async(req,res)=>{
  const assignment = req.body;
  const result = await submittionCollection.insertOne(assignment);
  res.send(result);
})

app.patch("/updateAssignmentCount/:classId", verifyToken,async (req, res) => {
  const { classId } = req.params;

  try {
    const filter = { _id: new ObjectId(classId) }; // Use classId here
    const update = { $inc: { AssgnmentCount: 1 } }; // Use $inc for incrementing

    const result = await classCollection.updateOne(filter, update);

    if (result.modifiedCount === 1) {
      res.status(200).send({ message: "Assignment count incremented successfully" });
    } else {
      res.status(404).send({ message: "Class not found" });
    }
  } catch (error) {
    console.error("Error updating assignment count:", error);
    res.status(500).send({ message: "Internal server error", error });
  }
});

 


// app.patch('/class/update-status/:classId',verifyToken, async(req,res)=>{
//   const id = req.params.classId;
//   const { status } = req.body;
//   console.log(status,id)
//   const filter = { _id: new ObjectId(id) };
//   const updatedDoc = {
//     $set: { status: status }
//   };
//   const result = await  classCollection.updateOne(filter, updatedDoc);
//   res.send(result);

// }) 




app.get('/myclasses/:email',verifyToken,async(req,res)=>{
  const {email}= req.params;
  const classes = await classCollection.find({email}).toArray();
  res.send(classes);  
}) 



app.get('/classes',verifyToken,async(req,res)=>{

const result = await classCollection.find().toArray();
res.send(result); 
})



app.get('/Allclass',async(req,res)=>{

const result = await classCollection.find().toArray();
res.send(result); 
})






app.patch('/class/update-status/:classId',verifyToken, async(req,res)=>{
  const id = req.params.classId;
  const { status } = req.body;
  console.log(status,id)
  const filter = { _id: new ObjectId(id) };
  const updatedDoc = {
    $set: { status: status }
  };
  const result = await  classCollection.updateOne(filter, updatedDoc);
  res.send(result);

})  

app.patch('/classes/:id',verifyToken,async(req,res)=>{
  const id = req.params.id;
  const updatedClass = req.body;
  console.log(updatedClass);
  const filter = {_id:new ObjectId(id)}
  const updatedDoc={
    $set:{
      title:updatedClass.title,
      price:updatedClass.price,
      Description:updatedClass.Description,
      image:updatedClass.image


    }
  };
  const result = await  classCollection.updateOne(filter, updatedDoc);
  res.send(result);


})


app.delete('/classes/:id',verifyToken,async(req,res)=>{

  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await classCollection.deleteOne(query);
  res.send(result);
})


//
app.post('/allEnroll',verifyToken,async(req,res)=>{
  const enrollClass = req.body;
  const result = await enrollCollection.insertOne(enrollClass);
  res.send(result)
})
app.get('/myEnroll/:email',verifyToken,async(req,res)=>{
  const {email}  = req.params;
  console.log(email) 
  
  const result = await enrollCollection.find({email}).toArray();
  res.send(result);
})
 
 
app.post('/submitFeedback',verifyToken,async(req,res)=>{
  const feedback = req.body;
  const result = await feedbackCollection.insertOne(feedback);
  res.send(result);
});


app.get('/feedback',async(req,res)=>{
  const result = await feedbackCollection.find().toArray();
  res.send(result);
})




///////////////////




    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

     


 


app.get('/',(req,res)=>{  

    res.send('boss is sitting')
} )

app.listen(port,()=>{
    console.log(`bistro boss is sitting on port ${port}`);
})