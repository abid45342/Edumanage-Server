const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
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
    const teacherCollection = client.db("EduManageDb").collection("teacher");

    // jwt releated api
    app.post('/jwt',async(req,res)=>{
        const user = req.body;
        const token = jwt.sign(user,process.env.ACCESS_SECRET_TOKEN,{expiresIn:'1h'});
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
            return res.status(401).send({message : 'forbidden access'})
          }
        
          req.decoded = decoded
          next();
         })
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
      })

 
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









      app.get('/users/role/:email',verifyToken,async(req,res)=>{
        const email = req.params.email;
        console.log(email)
        if(email!== req.decoded.email )
        {
          return res.status(403).send({message:'unauthorized access'})
        }
        const query = {email:email};
        const user = await userCollection.findOne(query);
        let role = '';
        if(user){
          role = user?.role ;
        }
        res.send({ role });
  
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


      app.get('/teacher-requests/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        // console.log(email);
    
        if (email !== req.decoded.email) {
            return res.status(403).send({ message: 'unauthorized access' });
        }
    
        try {
            const query = { email: email };
            const teacherRequests = await teacherRequestCollection.find(query).toArray();
            res.status(200).send(teacherRequests);
        } catch (error) {
            console.error('Error fetching teacher requests:', error);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    });

    app.get('/teacher',verifyToken,async(req,res)=>{
      const teacherRequests = await teacherRequestCollection.find().toArray();
      res.send(teacherRequests)

 
    })
    

    //////////////////

    
  
    // app.patch('/teacher/update-status/:id', verifyToken, async (req, res) => {
      
    //   const { id } = req.params;
    //   console.log(id)
    //   const { status } = req.body;

    //   if (!['accepted', 'rejected'].includes(status)) {
    //     return res.status(400).send({ message: 'Invalid status' });
    //   }

    //   try {
    //     const filter = { _id: new ObjectId(id) };
    //     const updatedDoc = {
    //       $set: { status },
    //     };

    //     const result = await teacherRequestCollection.updateOne(filter, updatedDoc);
    //     if (result.matchedCount === 0) {
    //       return res.status(404).send({ message: 'Teacher not found' });
    //     }

    //     res.status(200).send({ message: 'Teacher status updated', result });
    //   } catch (error) {
    //     res.status(500).send({ message: 'Error updating teacher status' });
    //   }
    // });


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

    // app.post('/teacher',async (req,res)=>{
    //   const teacher = req.body;
    //   const result = await teacherCollection.insertOne(teacher);
    //   res.send(result);
    // })


    app.post('/teacher', verifyToken, async (req, res) => {
      const { name,email, photoURL,role } = req.body;
       // Get the email from the query parameters
    
      if (!email) {
        return res.status(400).send({ message: 'Email is required.' });
      }
    
      try {
        // Check if the teacher with the given email already exists
        const existingTeacher = await teacherCollection.findOne({ email: email });
    
        if (existingTeacher) {
          // If teacher already exists, return a message and do not insert
          return res.status(400).send({ message: 'Teacher with this email already exists.' });
        }
    
        // If teacher does not exist, proceed with insertion
        const newTeacher = { name, email, photoURL , role };
        await teacherCollection.insertOne(newTeacher); 



 const filter = {email:email}
 const updatedDoc = {
  $set: {
    role: 'teacher'
  }
}
const re =  await userCollection.updateOne(filter, updatedDoc);
   










    
        res.status(201).send({ message: 'Teacher added successfully to the approved collection.', teacher: newTeacher });
      } catch (error) {
        console.error('Error adding teacher:', error);
        res.status(500).send({ message: 'Error adding teacher.' });
      }
    });
    




   








///////////////////




    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
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