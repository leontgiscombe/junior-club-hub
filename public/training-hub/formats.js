/* The Training Hub for every age group. The page itself (index.html) is the
   7v7 hub for under-9s and under-10s; this adds 5v5 (under-7s and 8s), 9v9
   (under-11s and 12s) and 11v11 (under-13s up), each with its own guide,
   quiz, skill challenges, tips and positions. Which one shows is the player's
   team's format (Coach Admin → Settings → the team's "Match format"), or the
   one picked on this phone. Uses the page's pitch drawing (buildPitch, P, B, A,
   Lbl) and swaps its quiz, challenges and tips over. */

/* ── Drawing helpers ── */
// a player coloured by their role, like the diagram key: keeper amber,
// defenders green, centre mids blue, wide players purple, strikers orange
function roleType(l){
  if(l==='GK')return 'gk';
  if(/^(CM|DM|AM|M)$/.test(l))return 'hi_mid';
  if(/^(LW|RW|L|R|LM|RM)$/.test(l))return 'hi_wide';
  if(/^(ST|S|CF)$/.test(l))return 'hi_st';
  return 'us';
}
function team(s,list){list.forEach(function(p){P(s,p[0],p[1],p[2],p[3]||roleType(p[2]),p[4]||(p[2]==='GK'?12:13));});}
function opp(s,list){list.forEach(function(p){P(s,p[0],p[1],p[2]||'',"opp",p[3]||11);});}
function line(s,x,label){
  el("line",{x1:x,y1:4,x2:x,y2:196,stroke:"rgba(255,255,255,0.9)","stroke-width":2,"stroke-dasharray":"6,4"},s);
  if(label)Lbl(s,x,190,label,"rgba(0,0,0,0.55)","white",70);
}
function zone(s,x,w,fill){el("rect",{x:x,y:2,width:w,height:196,fill:fill},s);}
// arrows start and stop clear of the players' circles, so they never cover a player's letters
function trim(x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy)||1;
  const a=Math.min(14,len*0.6), b=len>50?10:0;
  return [x1+dx/len*a, y1+dy/len*a, x2-dx/len*b, y2-dy/len*b];
}
function run(s,x1,y1,x2,y2){const c=trim(x1,y1,x2,y2);A(s,c[0],c[1],c[2],c[3],"ag",true);}   // a run without the ball (dashed green)
function pass(s,x1,y1,x2,y2){const c=trim(x1,y1,x2,y2);A(s,c[0],c[1],c[2],c[3],"a");}       // a pass (yellow)
function dribble(s,x1,y1,x2,y2){const c=trim(x1,y1,x2,y2);A(s,c[0],c[1],c[2],c[3],"aw",true,2);} // running with the ball (white)

/* ── The formats ── */
const HUB_FORMATS = {};

/* ════════════ 5v5 · under-7s and under-8s ════════════ */
(function(){
  const base=[[18,100,"GK"],[80,100,"D"],[145,38,"L"],[145,162,"R"],[215,100,"S"]];
  const D5={
    Spread(s){buildPitch(s);team(s,base);B(s,92,100);opp(s,[[200,70],[200,130],[262,100],[302,100,"GK"]]);run(s,145,38,145,8);run(s,145,162,145,192);},
    Swarm(s){buildPitch(s);team(s,[[18,100,"GK"],[80,100,"D"],[150,90,"S"],[166,106,"L"],[150,114,"R"]]);opp(s,[[160,94],[174,116],[262,100],[302,100,"GK"]]);B(s,160,104);run(s,150,124,150,172);Lbl(s,150,184,"FIND SPACE");},
    PassFriend(s){buildPitch(s);team(s,base);B(s,92,100);opp(s,[[120,100],[200,130],[262,100],[302,100,"GK"]]);pass(s,94,96,138,45);},
    AllDefend(s){buildPitch(s);team(s,[[18,100,"GK"],[70,100,"D"],[150,40,"L"],[150,160,"R"],[175,100,"S"]]);opp(s,[[118,100],[160,70],[150,130],[302,100,"GK"]]);B(s,106,100);run(s,150,48,105,70);run(s,150,152,105,130);run(s,175,100,135,100);},
    Shoot(s){buildPitch(s);team(s,[[18,100,"GK"],[90,100,"D"],[180,40,"L"],[180,160,"R"],[248,100,"S"]]);opp(s,[[225,60],[302,100,"GK"]]);B(s,260,100);pass(s,262,100,306,88);Lbl(s,262,128,"SHOOT!");},
    Retreat(s){buildPitch(s);team(s,[[18,100,"GK"],[90,100,"D"],[140,45,"L"],[140,155,"R"],[150,100,"S"]]);opp(s,[[302,100,"GK"],[262,60],[262,140],[225,100]]);B(s,290,100);line(s,160,"HALFWAY");run(s,196,45,156,45);},
    GKRoll(s){buildPitch(s);team(s,[[18,100,"GK"],[60,40,"L"],[110,100,"D"],[160,160,"R"],[215,100,"S"]]);B(s,30,100);opp(s,[[100,120],[160,90],[302,100,"GK"]]);pass(s,30,96,55,48);},
    Ready(s){buildPitch(s);team(s,[[22,100,"GK"],[60,150,"D"]]);opp(s,[[95,92]]);B(s,83,95);Lbl(s,58,52,"READY!",undefined,undefined,52);run(s,22,100,44,98);},
    GoalSide(s){buildPitch(s);team(s,[[18,100,"GK"],[70,92,"D"]]);opp(s,[[108,78]]);B(s,96,82);A(s,96,82,40,100,"ar",true,1.5);Lbl(s,60,124,"GOAL SIDE");},
    StayWide(s){buildPitch(s);team(s,[[18,100,"GK"],[80,100,"D"],[150,14,"L"],[150,186,"R"],[215,100,"S"]]);B(s,92,100);opp(s,[[150,85],[160,115],[262,100],[302,100,"GK"]]);pass(s,94,94,144,22);},
    Rebound(s){buildPitch(s);team(s,[[18,100,"GK"],[120,100,"D"],[200,40,"L"],[200,160,"R"],[240,105,"S"]]);opp(s,[[302,100,"GK"]]);pass(s,248,104,298,104);B(s,282,130);run(s,244,112,276,128);Lbl(s,252,150,"FOLLOW IT IN");},
    Look(s){buildPitch(s);team(s,[[18,100,"GK"],[80,100,"D"],[145,38,"L"],[145,162,"R"],[215,100,"S"]]);B(s,92,100);opp(s,[[175,48],[200,130],[302,100,"GK"]]);Lbl(s,145,70,"LOOK FIRST",undefined,undefined,66);pass(s,94,96,138,45);},
    WinBack(s){buildPitch(s);team(s,[[18,100,"GK"],[90,100,"D"],[160,40,"L"],[160,160,"R"],[218,100,"S"]]);opp(s,[[180,100],[260,60],[302,100,"GK"]]);B(s,168,100);run(s,218,100,194,100);run(s,160,40,174,84);run(s,160,160,174,116);},
  };
  HUB_FORMATS["5v5"]={
    label:"5v5", shape:"1-2-1", ages:"Under 7s & 8s",
    diagrams:D5,
    guideCats:[
      {id:"team",name:"Team",icon:"👥",bg:"#37474f"},
      {id:"gk",name:"Keeper",icon:"🧤",bg:"#e65100"},
      {id:"def",name:"Back Player",icon:"🛡️",bg:"#1b5e20"},
      {id:"wide",name:"Side Players",icon:"⚡",bg:"#6a1b9a"},
      {id:"st",name:"Front Player",icon:"⚽",bg:"#b71c1c"},
    ],
    guide:[
      {cat:"team",title:"Spread Out",d:"Spread",text:"Don't all run to the ball like bees! <strong>Spread out</strong> so there's always a friend to pass to."},
      {cat:"team",title:"Find Space",d:"Swarm",text:"If everyone's in a crowd, <strong>run away from the crowd</strong> to an empty space. Then shout for the ball!"},
      {cat:"team",title:"Pass to a Friend",d:"PassFriend",text:"Look up. If a friend has <strong>lots of space</strong>, pass it to them with the inside of your foot."},
      {cat:"team",title:"Everyone Defends",d:"AllDefend",text:"When the other team has the ball, <strong>everybody runs back</strong> to help. Even the front player!"},
      {cat:"team",title:"Win It Back",d:"WinBack",text:"Lost the ball? <strong>Try to win it straight back</strong> — the nearest player goes first."},
      {cat:"team",title:"The Retreat Line",d:"Retreat",text:"When their keeper has the ball for a goal kick, <strong>go back into your own half</strong> and wait until it's played. Then you can go and win it!"},
      {cat:"team",title:"Look Before It Comes",d:"Look",text:"Before the ball gets to you, <strong>have a quick look</strong> around. Then you know where to go next."},
      {cat:"gk",title:"Ready Position",d:"Ready",text:"Feet apart, knees bent, <strong>hands ready</strong> in front of you. Stay on your toes!"},
      {cat:"gk",title:"Roll It Out",d:"GKRoll",text:"Caught it? Great! Now <strong>roll it quickly</strong> to a friend who's free at the side."},
      {cat:"def",title:"Stay Goal Side",d:"GoalSide",text:"Stand <strong>between the attacker and your goal</strong>. Don't dive in — stay on your feet and slow them down."},
      {cat:"wide",title:"Stay Wide",d:"StayWide",text:"When we have the ball, go <strong>near the side lines</strong>. It makes the pitch big and gives your team space."},
      {cat:"st",title:"Shoot!",d:"Shoot",text:"Can you see the goal? <strong>Have a shot!</strong> Aim for the corners, away from the keeper."},
      {cat:"st",title:"Follow It In",d:"Rebound",text:"After you shoot, <strong>keep running</strong> towards the goal. If the keeper drops it, you can score!"},
    ],
    positions:{
      intro:"In 5v5 everyone gets a go in every position. These are your jobs when you're in each one.",
      shape:base,
      roles:[
        {l:"GK",name:"Keeper",zone:"Your goal and the area in front of it.",have:"Roll or pass it to a friend who's free.",not:"Stay in front of the goal, ready. Shout “keeper's ball!” when it's yours."},
        {l:"D",name:"Back Player",zone:"In front of our goal, in the middle.",have:"Be the safe pass behind your friends.",not:"Stand between the ball and our goal. Don't dive in."},
        {l:"L",name:"Left Side",zone:"The left side of the pitch, up and down.",have:"Go wide, near the side line.",not:"Run back and help the back player."},
        {l:"R",name:"Right Side",zone:"The right side of the pitch, up and down.",have:"Go wide, near the side line.",not:"Run back and help the back player."},
        {l:"S",name:"Front Player",zone:"Near their goal.",have:"Find space and shoot when you can!",not:"Chase the ball back first — you're a defender too."},
      ],
      rule:"Remember: if everyone's in one place, go somewhere else!",
    },
    quiz:{
      beginner:[
        {section:"⚽ With the Ball",q:"Everyone is running at the ball. What should you do?",diagram:"Swarm",opts:[
          {t:"Find a space away from the crowd",c:true,f:"Yes! Then your friend can pass to you."},
          {t:"Run into the crowd too",c:false,f:"Too many people there! Find some space."},
          {t:"Stand still and watch",c:false,f:"Keep moving — find a space!"},
          {t:"Go and sit down",c:false,f:"No way — you're needed! Find a space."}],tip:"\"Spread out like a big star!\""},
        {section:"⚽ With the Ball",q:"You have the ball and a friend is free. What's a good idea?",diagram:"PassFriend",opts:[
          {t:"Pass it to your free friend",c:true,f:"Great passing! That's teamwork."},
          {t:"Kick it out of the pitch",c:false,f:"Keep it on the pitch — pass to your friend!"},
          {t:"Hide the ball behind you",c:false,f:"Pass it to your free friend!"},
          {t:"Pick it up with your hands",c:false,f:"Only the keeper can use their hands!"}],tip:"\"Look up, then pass!\""},
        {section:"🔴 Without the Ball",q:"The other team has the ball. Who helps to defend?",diagram:"AllDefend",opts:[
          {t:"Everyone!",c:true,f:"Yes! We all help when they have the ball."},
          {t:"Only the keeper",c:false,f:"The keeper needs help — everyone defends!"},
          {t:"Nobody",c:false,f:"We always try to win it back!"},
          {t:"Only the back player",c:false,f:"Everyone helps, even the front player."}],tip:"\"When they've got it, we all get back!\""},
        {section:"⚽ With the Ball",q:"You can see the goal and nobody is in the way. What do you do?",diagram:"Shoot",opts:[
          {t:"Shoot!",c:true,f:"Go for it! Aim for the corners."},
          {t:"Pass it backwards",c:false,f:"The goal is right there — shoot!"},
          {t:"Wait for a defender",c:false,f:"Don't wait — have a shot!"},
          {t:"Kick it out",c:false,f:"Shoot at the goal!"}],tip:"\"See the goal? Have a go!\""},
        {section:"🧤 Keeper",q:"Where should the keeper stand?",diagram:"Ready",opts:[
          {t:"In front of the goal, in the middle",c:true,f:"Yes! Ready to stop shots."},
          {t:"By the corner flag",c:false,f:"Too far away! Stay in front of the goal."},
          {t:"In the other team's goal",c:false,f:"Stay at our goal!"},
          {t:"Behind the goal",c:false,f:"In front of the goal, in the middle."}],tip:"\"Ready position: feet apart, hands ready!\""},
        {section:"💚 Being a Good Teammate",q:"Your friend makes a mistake. What do you say?",opts:[
          {t:"“Never mind, keep going!”",c:true,f:"Lovely! Good teammates help each other."},
          {t:"Shout at them",c:false,f:"Be kind — everyone makes mistakes."},
          {t:"Say nothing and look cross",c:false,f:"Cheer them up instead!"},
          {t:"Tell them they're rubbish",c:false,f:"Never! Be kind to your teammates."}],tip:"\"Be kind, be brave, have fun!\""},
      ],
      intermediate:[
        {section:"📏 Rules",q:"Their keeper has the ball for a goal kick. Where do you go?",diagram:"Retreat",opts:[
          {t:"Back into my own half until it's played",c:true,f:"Yes — that's the retreat line. Then go and win it!"},
          {t:"Stand right next to the keeper",c:false,f:"You have to go back into your half first."},
          {t:"Into their goal",c:false,f:"Back into your own half until it's played!"},
          {t:"Off the pitch",c:false,f:"Stay on — just go back to your half."}],tip:"\"Goal kick? Back to halfway!\""},
        {section:"⚽ With the Ball",q:"You're a side player and we have the ball. Where should you be?",diagram:"StayWide",opts:[
          {t:"Out wide, near the side line",c:true,f:"Yes! That makes lots of space."},
          {t:"Right next to the ball",c:false,f:"Too close! Go wide and make space."},
          {t:"In our goal",c:false,f:"Go wide so we can pass to you."},
          {t:"Behind the keeper",c:false,f:"Out wide, near the side line!"}],tip:"\"Big pitch when we have it!\""},
        {section:"🔴 Without the Ball",q:"An attacker is dribbling at our goal. Where do you stand?",diagram:"GoalSide",opts:[
          {t:"Between them and our goal",c:true,f:"Goal side! Now slow them down."},
          {t:"Behind them",c:false,f:"Get between them and our goal."},
          {t:"By the corner flag",c:false,f:"Too far! Stand between them and the goal."},
          {t:"Dive in straight away",c:false,f:"Stay on your feet and slow them down first."}],tip:"\"Stay goal side, stay on your feet!\""},
        {section:"⚽ With the Ball",q:"You've just passed the ball. What's next?",opts:[
          {t:"Move into space to get it back",c:true,f:"Pass and move — brilliant!"},
          {t:"Stand still and clap",c:false,f:"Keep moving — find space!"},
          {t:"Sit down for a rest",c:false,f:"Pass and move!"},
          {t:"Walk off",c:false,f:"Keep moving so you can get it back."}],tip:"\"Pass and move!\""},
        {section:"🧤 Keeper",q:"The keeper catches the ball. What's best?",diagram:"GKRoll",opts:[
          {t:"Roll it quickly to a free friend",c:true,f:"Yes! Start the next attack."},
          {t:"Kick it as hard as you can every time",c:false,f:"A roll to a free friend keeps the ball."},
          {t:"Hold it for ages",c:false,f:"Be quick, before they're ready!"},
          {t:"Throw it out of the pitch",c:false,f:"Keep it on — roll it to a friend."}],tip:"\"Catch it, then roll it to a friend!\""},
        {section:"⚽ With the Ball",q:"You shot and the keeper saved it. What now?",diagram:"Rebound",opts:[
          {t:"Run in for the rebound",c:true,f:"Yes! Follow it in — you might score."},
          {t:"Turn around and walk away",c:false,f:"Keep going — follow your shot!"},
          {t:"Lie down",c:false,f:"Follow it in!"},
          {t:"Say sorry to the keeper",c:false,f:"Great save, but follow it in!"}],tip:"\"Shoot and follow it in!\""},
      ],
      expert:[
        {section:"⚽ With the Ball",q:"Which foot can you pass with?",opts:[
          {t:"Both — so practise with your other foot too",c:true,f:"Yes! Two good feet makes you super."},
          {t:"Only my best foot",c:false,f:"Practise your other foot too!"},
          {t:"Neither — I just dribble",c:false,f:"Passing is great! Use both feet."},
          {t:"My hands",c:false,f:"Only the keeper uses hands!"}],tip:"\"Two good feet!\""},
        {section:"🔄 Losing the Ball",q:"We just lost the ball. What should you do first?",diagram:"WinBack",opts:[
          {t:"Try to win it straight back",c:true,f:"Yes! The nearest player goes first."},
          {t:"Stop and get upset",c:false,f:"No time to be sad — win it back!"},
          {t:"Walk back slowly",c:false,f:"Quickly — try to win it back!"},
          {t:"Look at the coach",c:false,f:"Win it back first!"}],tip:"\"Lose it? Win it back!\""},
        {section:"⚽ With the Ball",q:"Before the ball comes to you, what should you do?",diagram:"Look",opts:[
          {t:"Look around to see where everyone is",c:true,f:"Clever! Then you know what to do next."},
          {t:"Close my eyes",c:false,f:"Open your eyes and look around!"},
          {t:"Look at the sky",c:false,f:"Look at your friends and the space."},
          {t:"Turn my back on the ball",c:false,f:"Watch the ball and have a quick look around."}],tip:"\"Look before it comes!\""},
        {section:"⚽ With the Ball",q:"Two defenders are in front of you, and a friend is free at the side. What's best?",diagram:"PassFriend",opts:[
          {t:"Pass to the free friend",c:true,f:"Smart! Go where the space is."},
          {t:"Dribble into both defenders",c:false,f:"Tricky! Pass to your free friend."},
          {t:"Kick it out",c:false,f:"Keep it — pass to your friend."},
          {t:"Stop and wait",c:false,f:"Your friend is free — pass!"}],tip:"\"Go where the space is!\""},
        {section:"📏 Rules",q:"Is there offside in 5v5?",opts:[
          {t:"No — there's no offside in 5v5",c:true,f:"Right! Offside comes in later, when you're older."},
          {t:"Yes, always",c:false,f:"Not in 5v5 — there's no offside."},
          {t:"Only on Tuesdays",c:false,f:"Ha! No offside in 5v5."},
          {t:"Only for the keeper",c:false,f:"There's no offside in 5v5."}],tip:"\"No offside in 5v5 — but don't just stand by their goal!\""},
        {section:"💚 Being a Good Teammate",q:"A player on the other team falls and is hurt. What do you do?",opts:[
          {t:"Tell the referee or a coach",c:true,f:"Kind and sensible! Grown-ups will help."},
          {t:"Keep playing and laugh",c:false,f:"Never laugh — tell a grown-up."},
          {t:"Kick the ball at them",c:false,f:"No! Tell the referee or a coach."},
          {t:"Walk off the pitch",c:false,f:"Tell the referee or a coach."}],tip:"\"Respect everyone — even the other team!\""},
      ],
    },
    skills:[
      {id:"f5_toetaps",cat:"⚽ Ball Magic",name:"20 Toe Taps",desc:"Tap the top of the ball with one foot, then the other — 20 taps!"},
      {id:"f5_solerolls",cat:"⚽ Ball Magic",name:"Sole Rolls",desc:"Roll the ball side to side under your foot — 10 each foot."},
      {id:"f5_stop",cat:"⚽ Ball Magic",name:"Stop!",desc:"Dribble, and stop the ball with your foot when a grown-up shouts “stop” — 10 times."},
      {id:"f5_cones",cat:"🏃 Dribbling",name:"Cone Slalom",desc:"Dribble in and out of 5 cones (or shoes) and back."},
      {id:"f5_turn",cat:"🏃 Dribbling",name:"Turn and Go",desc:"Dribble, pull the ball back with your sole and go the other way — 5 each foot."},
      {id:"f5_fast",cat:"🏃 Dribbling",name:"Speedy Dribble",desc:"Dribble as fast as you can across the garden or park, keeping the ball close."},
      {id:"f5_wall",cat:"🎯 Passing",name:"Wall Passes",desc:"Pass against a wall and stop it when it comes back — 10 times."},
      {id:"f5_gate",cat:"🎯 Passing",name:"Through the Gate",desc:"Put two cones as a gate and pass through it — 5 out of 10."},
      {id:"f5_target",cat:"🥅 Shooting",name:"Hit the Target",desc:"Shoot at a target (a goal, bin or box) — hit it 5 times."},
      {id:"f5_other",cat:"🥅 Shooting",name:"Other Foot Shots",desc:"5 shots with the foot you don't normally use."},
      {id:"f5_hops",cat:"💪 Fun Fitness",name:"Bunny Hops",desc:"10 big bunny hops over a line."},
      {id:"f5_cheetah",cat:"💪 Fun Fitness",name:"Run Like a Cheetah",desc:"3 super-fast sprints, with a rest in between."},
      {id:"f5_well",cat:"💚 Team Player",name:"Well Done!",desc:"Say “well done” to a teammate at training."},
      {id:"f5_tidy",cat:"💚 Team Player",name:"Super Helper",desc:"Help your coach tidy up the cones or balls."},
    ],
    tips:[
      "Spread out — don't all chase the ball!",
      "Look up before you pass.",
      "Use the inside of your foot to pass.",
      "Keep the ball close when you dribble.",
      "Everyone helps when they have the ball.",
      "Stay on your feet when you defend.",
      "See the goal? Have a shot!",
      "Follow your shot in — the keeper might drop it.",
      "Practise with both feet.",
      "Say “well done” to your teammates.",
      "Drink some water after training.",
      "Have fun and try your best!",
    ],
  };
})();

/* ════════════ 9v9 · under-11s and under-12s ════════════ */
(function(){
  const base=[[18,100,"GK"],[75,35,"LB"],[60,100,"CB"],[75,165,"RB"],[125,78,"CM"],[125,122,"CM"],[205,25,"LW"],[230,100,"ST"],[205,175,"RW"]];
  const oppBase=[[302,100,"GK"],[262,45],[270,100],[262,155],[205,78],[205,122],[150,40],[150,160]];
  const D9={
    Shape(s){buildPitch(s);team(s,base);B(s,72,100);Lbl(s,205,52,"WIDE",undefined,undefined,40);Lbl(s,205,148,"WIDE",undefined,undefined,40);},
    Compact(s){buildPitch(s);team(s,[[18,100,"GK"],[70,70,"LB"],[60,100,"CB"],[70,130,"RB"],[110,86,"CM"],[110,114,"CM"],[150,55,"LW"],[175,100,"ST"],[150,145,"RW"]]);opp(s,[[245,40],[262,100],[245,160],[302,100,"GK"]]);B(s,235,45);run(s,150,140,150,118);run(s,70,124,70,108);},
    Press5(s){buildPitch(s);team(s,[[18,100,"GK"],[90,45,"LB"],[80,100,"CB"],[90,155,"RB"],[150,80,"CM"],[150,120,"CM"],[215,40,"LW"],[232,92,"ST"],[222,160,"RW"]]);opp(s,[[198,126],[262,100],[262,150],[302,100,"GK"]]);B(s,186,128);run(s,232,92,206,118);run(s,222,160,206,138);run(s,150,120,180,124);Lbl(s,170,168,"WIN IT BACK!");},
    Switch(s){buildPitch(s);team(s,[[18,100,"GK"],[80,25,"LB"],[60,90,"CB"],[85,170,"RB"],[120,60,"CM"],[125,110,"CM"],[180,20,"LW"],[215,85,"ST"],[205,178,"RW"]]);opp(s,[[150,32],[170,52],[158,80],[205,48],[302,100,"GK"]]);B(s,132,62);pass(s,132,64,198,172);Lbl(s,190,140,"SWITCH IT!");},
    Offside(s){buildPitch(s);team(s,[[18,100,"GK"],[150,100,"CM"],[242,96,"ST"],[215,30,"LW"]]);opp(s,[[258,58],[258,136],[302,100,"GK"]]);B(s,162,100);line(s,258,"LAST DEFENDER");pass(s,164,100,284,110);run(s,242,96,284,96);},
    Sweeper(s){buildPitch(s);team(s,[[48,100,"GK"],[110,45,"LB"],[105,100,"CB"],[110,155,"RB"],[160,80,"CM"],[160,120,"CM"]]);opp(s,[[125,72],[200,100]]);B(s,75,70);A(s,198,96,80,72,"ar",true,1.5);run(s,52,96,70,74);Lbl(s,48,140,"SWEEP UP");},
    SplitBuild(s){buildPitch(s);team(s,[[18,100,"GK"],[45,22,"LB"],[56,100,"CB"],[45,178,"RB"],[105,78,"CM"],[105,122,"CM"],[200,20,"LW"],[230,100,"ST"],[200,180,"RW"]]);opp(s,[[80,58],[80,142],[140,100]]);B(s,30,110);pass(s,28,104,42,34);},
    StepUp(s){buildPitch(s);team(s,[[18,100,"GK"],[100,45,"LB"],[95,100,"CB"],[100,155,"RB"],[160,80,"CM"],[160,120,"CM"]]);opp(s,[[74,124],[200,100]]);run(s,58,45,80,45);run(s,52,100,76,100);run(s,58,155,80,155);line(s,96,"ONE LINE");Lbl(s,40,150,"OFFSIDE!","#e53935","white",60);},
    Overlap(s){buildPitch(s);team(s,[[18,100,"GK"],[60,100,"CB"],[130,120,"CM"],[200,160,"RW"],[120,175,"RB"]]);opp(s,[[234,148],[262,110]]);B(s,212,166);run(s,124,180,250,188);pass(s,212,170,244,184);Lbl(s,175,140,"OVERLAP",undefined,undefined,60);},
    OneStays(s){buildPitch(s);team(s,[[18,100,"GK"],[75,40,"LB"],[60,100,"CB"],[75,160,"RB"],[125,75,"CM"],[120,118,"CM"],[230,100,"ST"]]);B(s,137,75);dribble(s,140,74,190,70);Lbl(s,120,142,"I'LL STAY",undefined,undefined,60);opp(s,[[175,120],[262,100]]);},
    HalfTurn(s){buildPitch(s);team(s,[[18,100,"GK"],[60,100,"CB"],[125,110,"CM"],[205,170,"RW"],[230,100,"ST"]]);opp(s,[[150,95],[262,140]]);B(s,72,100);pass(s,74,102,118,108);pass(s,132,114,198,164);Lbl(s,125,140,"OPEN BODY",undefined,undefined,64);},
    OneVOne(s){buildPitch(s);team(s,[[18,100,"GK"],[150,80,"CM"],[230,100,"ST"]]);P(s,218,32,"LW","hi_wide");opp(s,[[256,44],[270,100],[302,100,"GK"]]);B(s,232,34);dribble(s,232,34,262,16);dribble(s,232,34,250,74);Lbl(s,215,64,"GO AT THEM",undefined,undefined,66);},
    TrackBack(s){buildPitch(s);team(s,[[18,100,"GK"],[75,40,"LB"],[60,100,"CB"],[120,85,"CM"],[170,24,"LW"]]);opp(s,[[118,30],[175,105]]);B(s,106,34);run(s,170,24,136,28);Lbl(s,172,52,"TRACK BACK",undefined,undefined,66);},
    LeadPress(s){buildPitch(s);team(s,[[160,80,"CM"],[160,120,"CM"],[220,40,"LW"],[230,110,"ST"],[220,160,"RW"]]);opp(s,[[268,90],[262,40],[262,160],[302,100,"GK"]]);B(s,280,88);run(s,234,108,262,96);A(s,276,92,264,48,"ar",true,1.5);Lbl(s,236,138,"CURVE YOUR RUN",undefined,undefined,80);},
    InBehind(s){buildPitch(s);team(s,[[18,100,"GK"],[150,95,"CM"],[240,100,"ST"],[215,30,"LW"],[215,170,"RW"]]);opp(s,[[252,75],[252,125],[302,100,"GK"]]);B(s,162,95);line(s,252,"");pass(s,164,95,286,88);run(s,244,96,284,86);},
  };
  HUB_FORMATS["9v9"]={
    label:"9v9", shape:"3-2-3", ages:"Under 11s & 12s",
    diagrams:D9,
    guideCats:[
      {id:"team",name:"Team",icon:"👥",bg:"#37474f"},
      {id:"gk",name:"Goalkeeper",icon:"🧤",bg:"#e65100"},
      {id:"def",name:"Defenders",icon:"🛡️",bg:"#1b5e20"},
      {id:"mid",name:"Centre Mids",icon:"🎯",bg:"#1565c0"},
      {id:"wide",name:"Wingers",icon:"⚡",bg:"#6a1b9a"},
      {id:"st",name:"Striker",icon:"⚽",bg:"#b71c1c"},
    ],
    guide:[
      {cat:"team",title:"Big When We Have It",d:"Shape",text:"With the ball, make the pitch <strong>as big as possible</strong>: wingers on the touchlines, full backs wide. Space makes passing easy."},
      {cat:"team",title:"Small When They Have It",d:"Compact",text:"Without it, <strong>squeeze together</strong> and shift towards the ball. Leave the far side — it's the furthest from our goal."},
      {cat:"team",title:"Win It Back Quickly",d:"Press5",text:"Just lost it? The <strong>nearest two or three press straight away</strong> for a few seconds, before they can look up. The rest get back into shape."},
      {cat:"team",title:"Switch the Play",d:"Switch",text:"If one side is crowded, <strong>move the ball to the other side</strong> — in one long pass, or two or three short ones through the middle."},
      {cat:"team",title:"Offside",d:"Offside",text:"In 9v9 there's <strong>offside</strong>. When the pass is played, you need to be level with or behind the last defender (the keeper usually counts as one of the last two). <strong>Time your run</strong> — go as the ball is played. Your league decides exactly where offside applies."},
      {cat:"gk",title:"Sweeper Keeper",d:"Sweeper",text:"When our defence is pushed up, <strong>stand further off your line</strong> so you can sweep up balls played over the top."},
      {cat:"gk",title:"Start the Attack",d:"SplitBuild",text:"From a goal kick, our full backs go <strong>wide and high</strong> and the centre back drops. Find the free player — and stay calm if it's pressed."},
      {cat:"def",title:"Step Up Together",d:"StepUp",text:"When the ball goes forward, the back three <strong>step up as one line</strong>. It makes us compact — and anyone left behind is offside."},
      {cat:"def",title:"Full Back Overlap",d:"Overlap",text:"When the winger has it and comes inside, the full back <strong>runs around the outside</strong>. Now they have two players to worry about."},
      {cat:"mid",title:"One Goes, One Stays",d:"OneStays",text:"Two centre mids: if one <strong>goes forward</strong>, the other <strong>stays</strong> to protect the defence. Talk to each other!"},
      {cat:"mid",title:"Open Your Body",d:"HalfTurn",text:"Receive <strong>side-on</strong>, with your body open to the pitch, so you can play forward with your first or second touch."},
      {cat:"wide",title:"Go 1v1",d:"OneVOne",text:"One against one? <strong>Attack the defender</strong> at speed — fake one way, go the other. Inside to shoot, outside to cross."},
      {cat:"wide",title:"Track Back",d:"TrackBack",text:"If their full back goes forward, <strong>run back with them</strong> so our full back isn't left 2v1."},
      {cat:"st",title:"Lead the Press",d:"LeadPress",text:"When their defender has it, <strong>curve your run</strong> so you block the pass to one side. The team follows your lead."},
      {cat:"st",title:"Run In Behind",d:"InBehind",text:"Stand on the defender's shoulder, then <strong>spin in behind</strong> as the pass is played. Stay onside until the ball is kicked!"},
    ],
    positions:{
      intro:"Our 9v9 shape is a 3-2-3: three at the back, two in the middle, three up front. Your zone is where you live — leave it to help, then get back.",
      shape:base,
      roles:[
        {l:"GK",name:"Goalkeeper",zone:"The box, and behind the defence when we push up.",have:"Start attacks — find a free defender or a midfielder.",not:"Organise the defence and sweep up balls over the top."},
        {l:"LB",name:"Left Back",zone:"The left channel of our half.",have:"Go wide and high to give us width; overlap the winger.",not:"Tuck in towards the centre back; stop crosses."},
        {l:"CB",name:"Centre Back",zone:"The middle of our half.",have:"Drop between the full backs and pass forward calmly.",not:"Lead the line — tell the others when to step up."},
        {l:"RB",name:"Right Back",zone:"The right channel of our half.",have:"Go wide and high to give us width; overlap the winger.",not:"Tuck in towards the centre back; stop crosses."},
        {l:"CM",name:"Centre Mids",zone:"The middle of the pitch, both halves.",have:"Get on the half-turn, keep it moving, switch the play. One goes, one stays.",not:"Protect the middle and the space in front of our defence."},
        {l:"LW",name:"Left Wing",zone:"The left touchline, their half.",have:"Stay wide, go 1v1, cross or cut in to shoot.",not:"Track their full back when they go forward."},
        {l:"ST",name:"Striker",zone:"Their half, between their centre backs.",have:"Hold it up, run in behind, be in the box for crosses.",not:"Lead the press — curve your run."},
        {l:"RW",name:"Right Wing",zone:"The right touchline, their half.",have:"Stay wide, go 1v1, cross or cut in to shoot.",not:"Track their full back when they go forward."},
      ],
      rule:"Big with the ball, small without it — and always talk.",
    },
    quiz:{
      beginner:[
        {section:"⚽ In Possession",q:"We have the ball. Where should our wingers be?",diagram:"Shape",opts:[
          {t:"Wide, near the touchlines",c:true,f:"Yes! Width stretches their defence."},
          {t:"In the middle next to the striker",c:false,f:"Too narrow — stay wide to make space."},
          {t:"Back in our own box",c:false,f:"Get forward and wide!"},
          {t:"Next to whoever has the ball",c:false,f:"Give them a wide option instead."}],tip:"\"Big when we have it!\""},
        {section:"🔴 Out of Possession",q:"They have the ball on their left. What does our team do?",diagram:"Compact",opts:[
          {t:"Squeeze together and shift towards the ball",c:true,f:"Exactly — compact and close to the ball."},
          {t:"Stay spread out wide",c:false,f:"That leaves gaps. Squeeze together."},
          {t:"Everyone runs at the ball",c:false,f:"Only the nearest presses — the rest shift over."},
          {t:"Stand still",c:false,f:"Shift as a team towards the ball."}],tip:"\"Small when they have it!\""},
        {section:"🔄 Transition",q:"We've just lost the ball. What's the first thing to do?",diagram:"Press5",opts:[
          {t:"The nearest players press straight away",c:true,f:"Yes! Win it back before they look up."},
          {t:"Everyone stops to argue",c:false,f:"No time! Press quickly."},
          {t:"Walk back to position",c:false,f:"Press first — the rest recover."},
          {t:"Wait for the ref",c:false,f:"Play on — win it back!"}],tip:"\"Lose it, win it back!\""},
        {section:"⚽ In Possession",q:"You're receiving a pass in midfield. How should your body be?",diagram:"HalfTurn",opts:[
          {t:"Side-on, open to the pitch",c:true,f:"Yes! Now you can see forward."},
          {t:"Facing my own goal",c:false,f:"Open up so you can play forward."},
          {t:"Lying down",c:false,f:"On your toes, side-on!"},
          {t:"Back to the ball",c:false,f:"Side-on, so you see the ball and the pitch."}],tip:"\"Open your body!\""},
        {section:"📏 Rules",q:"Can you be offside from a throw-in?",opts:[
          {t:"No",c:true,f:"Right — there's no offside from a throw-in, a goal kick or a corner."},
          {t:"Yes",c:false,f:"Not from a throw-in, a goal kick or a corner."},
          {t:"Only in the box",c:false,f:"No offside from a throw-in at all."},
          {t:"Only if you're the striker",c:false,f:"No — nobody is offside from a throw-in."}],tip:"\"No offside from throw-ins, corners or goal kicks!\""},
        {section:"🧤 Goalkeeper",q:"Our defence has pushed up to halfway. Where should the keeper be?",diagram:"Sweeper",opts:[
          {t:"Off the line, ready to sweep up",c:true,f:"Yes — a sweeper keeper!"},
          {t:"On the goal line",c:false,f:"Too deep — the space behind our defence is yours."},
          {t:"Up with the defenders",c:false,f:"A little behind them, to sweep up."},
          {t:"In the corner",c:false,f:"Central and off your line."}],tip:"\"Sweeper keeper!\""},
        {section:"⚽ In Possession",q:"One side of the pitch is really crowded. What should we do?",diagram:"Switch",opts:[
          {t:"Switch the play to the other side",c:true,f:"Yes — go where the space is!"},
          {t:"Keep dribbling into the crowd",c:false,f:"Find the space on the other side."},
          {t:"Kick it out for a throw",c:false,f:"Keep it — switch it!"},
          {t:"Give it to the keeper every time",c:false,f:"Switch the play to the space."}],tip:"\"Switch it!\""},
        {section:"💚 Respect",q:"The referee makes a decision you don't agree with. What do you do?",opts:[
          {t:"Accept it and get on with the game",c:true,f:"Respect! The referee's decision is final."},
          {t:"Shout at the referee",c:false,f:"Never — respect the referee."},
          {t:"Kick the ball away",c:false,f:"That could get you a card! Get on with it."},
          {t:"Stop playing",c:false,f:"Play on and focus on the next action."}],tip:"\"Respect the referee — always.\""},
      ],
      intermediate:[
        {section:"📏 Rules",q:"When is a player in an offside position?",diagram:"Offside",opts:[
          {t:"In the opposition half, nearer their goal line than the ball and the second-last defender, when the ball is played",c:true,f:"That's it! Being level is onside."},
          {t:"Any time they're near the goal",c:false,f:"Offside only counts when the ball is played to them."},
          {t:"When they're in their own half",c:false,f:"You can't be offside in your own half."},
          {t:"When they're level with the last defender",c:false,f:"Level is onside!"}],tip:"\"Level is onside — time your run.\""},
        {section:"⚽ In Possession",q:"Goal kick, and they're pressing. What do our full backs do?",diagram:"SplitBuild",opts:[
          {t:"Go wide and high to make space",c:true,f:"Yes — split wide so the keeper has options."},
          {t:"Stand next to the centre back",c:false,f:"Too close — split wide."},
          {t:"Run up front",c:false,f:"Wide and high, not up front."},
          {t:"Stand on the goal line",c:false,f:"Get wide to receive."}],tip:"\"Split wide to build!\""},
        {section:"🔴 Out of Possession",q:"We've cleared the ball upfield. What should the back three do?",diagram:"StepUp",opts:[
          {t:"Step up together as one line",c:true,f:"Yes — compact, and their forwards are left offside."},
          {t:"Stay on the edge of our box",c:false,f:"That leaves a big gap. Step up!"},
          {t:"Each go a different way",c:false,f:"Step up together, as one line."},
          {t:"Sit down",c:false,f:"Step up as one!"}],tip:"\"Step up as one!\""},
        {section:"⚽ In Possession",q:"Our winger has the ball and is going inside. What can the full back do?",diagram:"Overlap",opts:[
          {t:"Overlap around the outside",c:true,f:"Yes! Now it's 2v1 on the wing."},
          {t:"Stand still and watch",c:false,f:"Get forward — overlap!"},
          {t:"Run into the winger",c:false,f:"Go around the outside."},
          {t:"Go in goal",c:false,f:"Overlap on the outside."}],tip:"\"Overlap to make 2v1!\""},
        {section:"⚽ In Possession",q:"Your centre mid partner has run forward. What should you do?",diagram:"OneStays",opts:[
          {t:"Stay back to protect the defence",c:true,f:"Yes — one goes, one stays."},
          {t:"Run forward too",c:false,f:"Then nobody protects the middle."},
          {t:"Go out wide",c:false,f:"Stay central to protect."},
          {t:"Walk off",c:false,f:"Stay and protect!"}],tip:"\"One goes, one stays.\""},
        {section:"🔴 Out of Possession",q:"Their full back runs past you on the wing. You're the winger. What now?",diagram:"TrackBack",opts:[
          {t:"Track back with them",c:true,f:"Yes — don't leave our full back 2v1."},
          {t:"Wait up front for the ball",c:false,f:"Help your full back!"},
          {t:"Shout at the full back",c:false,f:"Run back and help."},
          {t:"Go to the other wing",c:false,f:"Track your runner."}],tip:"\"Track your runner!\""},
        {section:"⚽ In Possession",q:"You're a winger 1v1 with their full back. What's the plan?",diagram:"OneVOne",opts:[
          {t:"Attack them at speed and make them choose",c:true,f:"Yes! Fake one way, go the other."},
          {t:"Pass back every time",c:false,f:"Have a go — 1v1 is your chance!"},
          {t:"Stand still with the ball",c:false,f:"Attack at speed!"},
          {t:"Kick it at them",c:false,f:"Take them on."}],tip:"\"1v1? Go at them!\""},
        {section:"🔴 Out of Possession",q:"Their centre back has the ball. How should our striker press?",diagram:"LeadPress",opts:[
          {t:"Curve the run to block a pass to one side",c:true,f:"Yes — show them where you want them to go."},
          {t:"Sprint straight at them",c:false,f:"A curved run cuts off a pass too."},
          {t:"Stay still",c:false,f:"Lead the press!"},
          {t:"Run back to our box",c:false,f:"Press from the front."}],tip:"\"Curve your run.\""},
      ],
      expert:[
        {section:"📏 Rules",q:"You're in an offside position but not involved in play. Is it an offence?",opts:[
          {t:"No — it's only an offence if you get involved",c:true,f:"Right — being there isn't enough."},
          {t:"Yes, always",c:false,f:"Only if you become involved in play."},
          {t:"Only if you're the striker",c:false,f:"It's about getting involved, not your position."},
          {t:"Only in the first half",c:false,f:"It's only an offence if you get involved."}],tip:"\"Offside position isn't an offence until you're involved.\""},
        {section:"⚽ In Possession",q:"How should a striker time a run in behind?",diagram:"InBehind",opts:[
          {t:"Start onside and go as the pass is played",c:true,f:"Perfect timing!"},
          {t:"Go early and wait behind the defence",c:false,f:"That's offside!"},
          {t:"Only after the defender turns",c:false,f:"Go as the ball is played."},
          {t:"Never run in behind",c:false,f:"It's a great weapon — just time it."}],tip:"\"On the shoulder, then spin.\""},
        {section:"🔄 Transition",q:"Why do only the nearest players press when we lose the ball?",diagram:"Press5",opts:[
          {t:"So the rest can protect the space behind",c:true,f:"Yes — pressure on the ball, cover behind."},
          {t:"Because the others are tired",c:false,f:"It's about balance — cover behind."},
          {t:"There's a rule about it",c:false,f:"No rule — it's about balance."},
          {t:"So the keeper can join in",c:false,f:"The rest protect the space behind."}],tip:"\"Pressure and cover.\""},
        {section:"⚽ In Possession",q:"Switching play: one long pass or a few short ones?",diagram:"Switch",opts:[
          {t:"Either — whichever is quick and safe",c:true,f:"Right! Speed of the switch is what matters."},
          {t:"Always one long pass",c:false,f:"Short and quick can work too."},
          {t:"Never switch",c:false,f:"Switching finds the space."},
          {t:"Only in the second half",c:false,f:"Switch whenever the space is there."}],tip:"\"Switch quickly before they shift.\""},
        {section:"🧤 Goalkeeper",q:"As a keeper, what's your biggest job when we don't have the ball?",opts:[
          {t:"Organise and talk to the defence",c:true,f:"Yes — you see everything, so tell them!"},
          {t:"Stay quiet",c:false,f:"Talk! You see the whole pitch."},
          {t:"Stand on the line only",c:false,f:"Off your line, and talk."},
          {t:"Wait for a shot",c:false,f:"Organise before the shot happens."}],tip:"\"Keepers talk!\""},
        {section:"🔴 Out of Possession",q:"The ball is on our left. Where should our right back be?",diagram:"Compact",opts:[
          {t:"Tucked in towards the centre back",c:true,f:"Yes — cover the middle; the far side can wait."},
          {t:"On the right touchline",c:false,f:"Too wide — tuck in."},
          {t:"Up front",c:false,f:"Defend first — tuck in."},
          {t:"Next to the ball on the left",c:false,f:"Tuck in, don't chase across."}],tip:"\"Far side full back tucks in.\""},
        {section:"⚽ In Possession",q:"What does 'scanning' mean?",opts:[
          {t:"Looking around before you get the ball",c:true,f:"Yes — the best players scan all the time."},
          {t:"Watching only the ball",c:false,f:"Look away from the ball too."},
          {t:"Looking at the crowd",c:false,f:"Look at teammates, opponents and space."},
          {t:"Checking your boots",c:false,f:"Looking around before the ball arrives."}],tip:"\"Scan, scan, scan.\""},
        {section:"💚 Respect",q:"You score. How do you celebrate?",opts:[
          {t:"With the team, then quickly back for kick-off",c:true,f:"Enjoy it — and respect the opponents."},
          {t:"In the other team's faces",c:false,f:"Never — respect your opponents."},
          {t:"By running off the pitch",c:false,f:"Celebrate with your team on the pitch."},
          {t:"By taking your shirt off",c:false,f:"That's a yellow card! Celebrate with your team."}],tip:"\"Win well, lose well.\""},
      ],
    },
    skills:[
      {id:"f9_ku30",cat:"⚽ Ball Control",name:"30 Kick-Ups",desc:"Keep it up for 30 — feet and thighs only."},
      {id:"f9_touch",cat:"⚽ Ball Control",name:"Cushion Control",desc:"Throw the ball high and control it dead with one touch — 10 times each foot."},
      {id:"f9_halfturn",cat:"⚽ Ball Control",name:"Receive on the Half-Turn",desc:"Receive from a wall side-on and turn in one touch — 10 each way."},
      {id:"f9_wall",cat:"🎯 Passing",name:"Two-Touch Wall",desc:"Pass at a wall, control, pass — 20 in a row with both feet."},
      {id:"f9_long",cat:"🎯 Passing",name:"Switch Pass",desc:"Hit a 25-metre pass onto a target — 5 out of 10."},
      {id:"f9_weak",cat:"🎯 Passing",name:"Weak Foot Week",desc:"Use only your weaker foot for 10 minutes of passing."},
      {id:"f9_scan",cat:"🎯 Passing",name:"Scan Before It Comes",desc:"Check over each shoulder before every pass at training."},
      {id:"f9_1v1",cat:"🏃 Dribbling",name:"1v1 Moves",desc:"Learn one move (step-over, drag-back or Cruyff turn) and use it 10 times."},
      {id:"f9_speed",cat:"🏃 Dribbling",name:"Speed Dribble",desc:"Dribble 30 metres at full pace with the ball close — 5 times."},
      {id:"f9_finish",cat:"🥅 Finishing",name:"Low and Hard",desc:"10 shots low into the corners — count how many hit the target."},
      {id:"f9_volley",cat:"🥅 Finishing",name:"Side Volleys",desc:"Drop the ball and volley it at a target — 10 each foot."},
      {id:"f9_sprint",cat:"💪 Fitness",name:"Sprint Repeats",desc:"6 × 20-metre sprints, 30 seconds' rest between each."},
      {id:"f9_core",cat:"💪 Fitness",name:"Plank",desc:"Hold a plank for 3 × 30 seconds."},
      {id:"f9_stretch",cat:"💪 Fitness",name:"Cool Down",desc:"Stretch for 5 minutes after training or a game."},
      {id:"f9_watch",cat:"🧠 Mindset",name:"Watch a Pro",desc:"Watch a pro in your position for 10 minutes. What do they do without the ball?"},
      {id:"f9_review",cat:"🧠 Mindset",name:"Match Review",desc:"After a game: one thing you did well, one thing to work on."},
    ],
    tips:[
      "Scan over your shoulder before the ball arrives.",
      "Receive side-on so you can play forward.",
      "Big with the ball, small without it.",
      "Lost it? The nearest players press straight away.",
      "Time your run — go as the pass is played.",
      "Level with the last defender is onside.",
      "If one side is crowded, switch the play.",
      "Two centre mids: one goes, one stays.",
      "Full backs: when the winger comes inside, overlap.",
      "Wingers: track your runner when they go forward.",
      "Keepers: talk to your defence all game.",
      "Practise with your weaker foot every week.",
      "Respect the referee — always.",
      "Sleep and water help you play your best.",
      "Win well, lose well.",
    ],
  };
})();

/* ════════════ 11v11 · under-13s and up ════════════ */
(function(){
  const base=[[18,100,"GK"],[80,28,"LB"],[62,78,"CB"],[62,122,"CB"],[80,172,"RB"],[110,100,"DM"],[145,68,"CM"],[145,132,"CM"],[220,28,"LW"],[240,100,"ST"],[220,172,"RW"]];
  const D11={
    Thirds(s){buildPitch(s);zone(s,107,1.5,"rgba(255,255,255,0.6)");zone(s,213,1.5,"rgba(255,255,255,0.6)");team(s,[[18,100,"GK"],[62,80,"CB"],[110,100,"DM"],[160,70,"CM"],[240,100,"ST"]]);B(s,74,80);pass(s,74,84,97,95);pass(s,118,96,148,77);pass(s,168,70,232,96);Lbl(s,53,190,"BUILD",undefined,undefined,46);Lbl(s,160,190,"PROGRESS",undefined,undefined,60);Lbl(s,266,190,"FINISH",undefined,undefined,46);},
    WidthDepth(s){buildPitch(s);team(s,base);B(s,74,78);Lbl(s,220,54,"WIDTH",undefined,undefined,44);Lbl(s,220,146,"WIDTH",undefined,undefined,44);Lbl(s,268,124,"DEPTH",undefined,undefined,44);pass(s,74,78,98,96);},
    Trigger(s){buildPitch(s);team(s,[[110,100,"DM"],[160,68,"CM"],[160,132,"CM"],[215,40,"LW"],[225,100,"ST"],[215,160,"RW"]]);opp(s,[[262,70],[262,130],[302,100,"GK"],[250,30]]);B(s,272,72);Lbl(s,288,52,"BAD TOUCH",undefined,undefined,60);run(s,228,96,256,76);run(s,218,46,246,62);run(s,162,72,200,82);},
    Counter(s){buildPitch(s);team(s,[[18,100,"GK"],[62,78,"CB"],[62,122,"CB"],[120,100,"DM"],[150,80,"CM"],[200,30,"LW"],[200,100,"ST"],[200,170,"RW"]]);opp(s,[[142,120],[262,80],[262,120],[302,100,"GK"]]);B(s,160,82);pass(s,162,80,187,92);run(s,204,34,262,40);run(s,204,166,262,160);run(s,206,100,250,100);Lbl(s,150,130,"GO!",undefined,undefined,30);},
    Rest(s){buildPitch(s);team(s,[[18,100,"GK"],[100,80,"CB"],[100,120,"CB"],[140,100,"DM"],[200,40,"CM"],[235,140,"CM"],[265,25,"LW"],[270,100,"ST"],[265,175,"RW"],[200,185,"RB"]]);opp(s,[[165,100],[150,55]]);B(s,248,140);Lbl(s,105,160,"REST DEFENCE",undefined,undefined,76);},
    Offside(s){buildPitch(s);team(s,[[150,100,"CM"],[240,152,"RW"],[276,94,"ST"]]);opp(s,[[256,62],[258,122],[302,100,"GK"]]);B(s,162,100);line(s,258,"2ND-LAST");Lbl(s,284,40,"OFFSIDE","#e53935","white",52);Lbl(s,214,176,"ONSIDE","#2e7d32","white",50);},
    GKCommand(s){buildPitch(s);team(s,[[30,72,"GK"],[66,118,"CB"],[72,148,"CB"],[86,40,"LB"]]);opp(s,[[48,100],[56,58],[150,20]]);el("path",{d:"M150,24 Q100,30 42,66",stroke:"rgba(255,255,255,0.6)","stroke-width":1.5,fill:"none","stroke-dasharray":"5,3"},s);B(s,42,66);Lbl(s,30,40,"KEEPER'S!",undefined,undefined,56);},
    BackFour(s){buildPitch(s);team(s,[[18,100,"GK"],[110,38,"LB"],[80,66,"CB"],[72,102,"CB"],[78,136,"RB"],[125,92,"DM"]]);opp(s,[[142,22],[175,62],[205,104]]);B(s,130,26);run(s,80,36,96,38);run(s,62,80,72,72);run(s,62,122,68,108);run(s,80,172,78,150);Lbl(s,90,182,"SHIFT AS FOUR",undefined,undefined,76);},
    Cover(s){buildPitch(s);team(s,[[18,100,"GK"],[95,80,"CB"],[70,112,"CB"],[85,165,"RB"]]);opp(s,[[124,82],[108,140]]);B(s,136,80);run(s,62,120,68,112);Lbl(s,95,56,"PRESS",undefined,undefined,40);Lbl(s,50,132,"COVER",undefined,undefined,40);},
    Underlap(s){buildPitch(s);team(s,[[62,122,"CB"],[110,100,"DM"],[150,130,"CM"],[216,178,"RW"],[130,170,"RB"]]);opp(s,[[252,160],[268,118]]);B(s,230,180);run(s,140,164,238,140);pass(s,228,174,240,148);Lbl(s,190,110,"UNDERLAP",undefined,undefined,56);},
    Screen(s){buildPitch(s);team(s,[[18,100,"GK"],[62,78,"CB"],[62,122,"CB"],[106,104,"DM"]]);opp(s,[[142,100],[190,86]]);B(s,200,90);A(s,194,92,156,99,"ar",true,1.5);Lbl(s,100,140,"SCREEN",undefined,undefined,46);},
    ThirdMan(s){buildPitch(s);team(s,[[62,90,"CB"],[150,70,"CM"],[215,100,"ST"]]);opp(s,[[190,90],[190,60],[250,100]]);B(s,74,90);pass(s,76,92,207,100);pass(s,206,104,232,72);run(s,154,66,234,66);Lbl(s,140,96,"1",undefined,undefined,14);Lbl(s,216,120,"2",undefined,undefined,14);Lbl(s,230,52,"3",undefined,undefined,14);},
    Invert(s){buildPitch(s);team(s,[[220,172,"RW"],[150,175,"RB"],[236,96,"ST"]]);opp(s,[[262,174],[270,118],[302,100,"GK"]]);B(s,233,170);dribble(s,236,164,254,138);pass(s,258,134,296,108);run(s,154,182,244,192);Lbl(s,196,136,"CUT IN",undefined,undefined,40);},
    Cutback(s){buildPitch(s);team(s,[[296,36,"LW"],[256,72,"ST"],[234,116,"CM"]]);opp(s,[[284,80],[272,136],[308,100,"GK"]]);B(s,304,44);pass(s,300,48,244,112);run(s,256,72,282,52);Lbl(s,222,150,"PENALTY SPOT",undefined,undefined,70);},
    Pin(s){buildPitch(s);team(s,[[160,100,"CM"],[240,100,"ST"],[220,30,"LW"],[220,170,"RW"]]);opp(s,[[268,76],[268,124],[302,100,"GK"],[250,30],[250,170]]);B(s,172,100);Lbl(s,250,140,"PIN THEM",undefined,undefined,50);run(s,224,36,278,60);},
    NearPost(s){buildPitch(s);team(s,[[296,172,"RW"],[250,100,"ST"],[230,64,"CM"]]);opp(s,[[272,78],[262,142],[306,100,"GK"]]);B(s,300,176);el("path",{d:"M296,166 Q302,142 292,126",stroke:"#f9a825","stroke-width":2.5,fill:"none","marker-end":"url(#a)"},s);run(s,254,104,286,120);Lbl(s,214,128,"NEAR POST",undefined,undefined,56);},
  };
  HUB_FORMATS["11v11"]={
    label:"11v11", shape:"4-3-3", ages:"Under 13s and up",
    diagrams:D11,
    guideCats:[
      {id:"team",name:"Team",icon:"👥",bg:"#37474f"},
      {id:"gk",name:"Goalkeeper",icon:"🧤",bg:"#e65100"},
      {id:"def",name:"Defenders",icon:"🛡️",bg:"#1b5e20"},
      {id:"mid",name:"Midfield",icon:"🎯",bg:"#1565c0"},
      {id:"wide",name:"Wingers",icon:"⚡",bg:"#6a1b9a"},
      {id:"st",name:"Striker",icon:"⚽",bg:"#b71c1c"},
    ],
    guide:[
      {cat:"team",title:"Play Through the Thirds",d:"Thirds",text:"<strong>Build</strong> in our third, <strong>progress</strong> through the middle, <strong>finish</strong> in theirs. Every pass should help the ball move up a third — or keep it safely until it can."},
      {cat:"team",title:"Width and Depth",d:"WidthDepth",text:"With the ball, the wingers <strong>hold the width</strong> and the striker <strong>stretches them back</strong>. A long, wide team opens gaps between their lines."},
      {cat:"team",title:"Pressing Triggers",d:"Trigger",text:"Press together on a <strong>trigger</strong>: a bad touch, a back pass, a player facing their own goal, or a pass to the touchline. Go as one — not one at a time."},
      {cat:"team",title:"Counter-Attack",d:"Counter",text:"Win it in midfield? <strong>Play forward fast</strong> before they recover. Wingers sprint wide, the striker attacks the space."},
      {cat:"team",title:"Rest Defence",d:"Rest",text:"Even when we attack, keep <strong>the two centre backs and the holding mid</strong> ready, so a lost ball doesn't become a counter-attack against us."},
      {cat:"team",title:"Offside",d:"Offside",text:"You're offside if, when the ball is played to you, you're in their half and <strong>nearer their goal line than both the ball and the second-last opponent</strong> — and you then get involved. Level is onside. No offside from goal kicks, throw-ins or corners."},
      {cat:"gk",title:"Command Your Box",d:"GKCommand",text:"On crosses, <strong>call early and loud</strong> — “keeper's!” or “away!”. Come for what you can win; stay for what you can't."},
      {cat:"def",title:"Shift as a Four",d:"BackFour",text:"The back four <strong>slide across together</strong>: the full back nearest the ball presses, the centre backs move over, the far full back tucks in. No gaps between you."},
      {cat:"def",title:"Press and Cover",d:"Cover",text:"When one centre back <strong>steps out to press</strong>, the other <strong>drops in behind</strong> to cover. Talk: “I've got him!” “I'm behind you!”"},
      {cat:"def",title:"Overlap or Underlap",d:"Underlap",text:"Full backs: if the winger stays wide, <strong>run inside them</strong> (underlap); if they come inside, <strong>go around the outside</strong> (overlap)."},
      {cat:"mid",title:"Screen the Defence",d:"Screen",text:"The holding mid sits <strong>in front of the centre backs</strong>, blocking passes into the striker and picking up second balls."},
      {cat:"mid",title:"The Third-Man Run",d:"ThirdMan",text:"<strong>Pass, lay-off, run</strong>: the centre back plays into the striker, who sets it for a midfielder already running beyond. Defenders watching the ball miss the third man."},
      {cat:"wide",title:"Cut In or Go Outside",d:"Invert",text:"Read the full back: <strong>cut inside onto your stronger foot</strong> to shoot, or <strong>go outside</strong> when our full back overlaps and the space opens."},
      {cat:"wide",title:"The Cut-Back",d:"Cutback",text:"Got to the byline? <strong>Pull it back</strong> towards the penalty spot instead of crossing high — the defenders are running towards their own goal."},
      {cat:"st",title:"Pin the Centre Backs",d:"Pin",text:"Stay <strong>between their centre backs</strong> and keep them busy, so they can't step out — that's what frees the space for our midfielders and wingers."},
      {cat:"st",title:"Attack the Near Post",d:"NearPost",text:"On a cross, <strong>sprint to the near post</strong> to flick it on or finish. Someone else fills the far post."},
    ],
    positions:{
      intro:"Our 11v11 shape is a 4-3-3: a back four, a holding midfielder with two more in front, and a front three. Know your job with the ball, without it, and when it changes.",
      shape:base,
      roles:[
        {l:"GK",name:"Goalkeeper",zone:"The box and the space behind the back four.",have:"Start attacks short when it's on; be an extra passer.",not:"Command the box, organise the defence, sweep behind."},
        {l:"LB",name:"Full Backs (LB, RB)",zone:"The wide channels, our half and into theirs.",have:"Give width when the winger comes inside; overlap or underlap.",not:"Shift with the back four; stop crosses; far side tucks in."},
        {l:"CB",name:"Centre Backs",zone:"The middle of our half.",have:"Split wide when building; pass forward through the lines.",not:"Press and cover; hold the line together; win headers and second balls."},
        {l:"DM",name:"Holding Midfielder",zone:"In front of the centre backs.",have:"Show for the ball, play forward, switch the play.",not:"Screen passes into their striker; stay as rest defence."},
        {l:"CM",name:"Centre Mids",zone:"The middle third, box to box.",have:"Receive between the lines; make third-man runs into the box.",not:"Press on the trigger, then recover into shape."},
        {l:"LW",name:"Wingers (LW, RW)",zone:"The touchlines in their half.",have:"Hold the width, go 1v1, cut in or cut back.",not:"Press their full back; track runners."},
        {l:"ST",name:"Striker",zone:"Between their centre backs.",have:"Pin the centre backs, run in behind, attack the near post.",not:"Lead the press and cut off a pass to one side."},
      ],
      rule:"Every player has three jobs: with the ball, without it, and in the moment it changes.",
    },
    quiz:{
      beginner:[
        {section:"⚽ In Possession",q:"What should our wingers do to help us keep the ball?",diagram:"WidthDepth",opts:[
          {t:"Hold the width near the touchlines",c:true,f:"Yes — width stretches their back four."},
          {t:"Come into the middle",c:false,f:"That makes the pitch small. Stay wide."},
          {t:"Drop next to the centre backs",c:false,f:"Stay high and wide."},
          {t:"Stand next to the striker",c:false,f:"Hold the width."}],tip:"\"Width and depth.\""},
        {section:"📏 Rules",q:"When the ball is played to you, you're level with the second-last defender. Are you offside?",diagram:"Offside",opts:[
          {t:"No — level is onside",c:true,f:"Right! Level is onside."},
          {t:"Yes",c:false,f:"Level is onside."},
          {t:"Only if you score",c:false,f:"Level is onside, whatever happens next."},
          {t:"Only in the box",c:false,f:"Level is onside anywhere."}],tip:"\"Level is onside.\""},
        {section:"🔴 Out of Possession",q:"The ball is with their right winger. What does our back four do?",diagram:"BackFour",opts:[
          {t:"Slide across together",c:true,f:"Yes — no gaps between you."},
          {t:"Stay where they are",c:false,f:"Shift as a four!"},
          {t:"All run at the winger",c:false,f:"Only the nearest presses."},
          {t:"Drop to the goal line",c:false,f:"Shift across, don't drop deep."}],tip:"\"Shift as a four.\""},
        {section:"🔄 Transition",q:"We win the ball in midfield and they're out of shape. What now?",diagram:"Counter",opts:[
          {t:"Play forward quickly before they recover",c:true,f:"Yes — counter-attack!"},
          {t:"Pass back to the keeper",c:false,f:"Go forward — they're not ready!"},
          {t:"Slow it right down every time",c:false,f:"Not now — attack the space."},
          {t:"Kick it out",c:false,f:"Counter-attack!"}],tip:"\"Win it, go forward.\""},
        {section:"🧤 Goalkeeper",q:"A cross is coming into the box and you can get it. What should you do?",diagram:"GKCommand",opts:[
          {t:"Call loudly — “keeper's!” — and go for it",c:true,f:"Yes — early, loud, decisive."},
          {t:"Stay quiet and see what happens",c:false,f:"Call it!"},
          {t:"Wait on the line",c:false,f:"If you can win it, come and get it."},
          {t:"Shout “away!” and then go for it too",c:false,f:"Make one clear call."}],tip:"\"Call early, call loud.\""},
        {section:"⚽ In Possession",q:"What's the holding midfielder's main job when we have the ball?",diagram:"Screen",opts:[
          {t:"Show for the ball and keep it moving forward",c:true,f:"Yes — and stay ready as rest defence."},
          {t:"Run into the box every time",c:false,f:"That's the other mids' job."},
          {t:"Stay out of the way",c:false,f:"Show for it!"},
          {t:"Play only backwards",c:false,f:"Forward when it's on."}],tip:"\"Show, receive, play forward.\""},
        {section:"⚽ In Possession",q:"You're a winger at the byline. Their defenders are running back towards goal. Best option?",diagram:"Cutback",opts:[
          {t:"Cut it back towards the penalty spot",c:true,f:"Yes — the hardest ball to defend."},
          {t:"Shoot from the byline",c:false,f:"Almost no angle — cut it back."},
          {t:"Dribble out of play",c:false,f:"Cut it back!"},
          {t:"Pass back to the centre back",c:false,f:"Not now — cut it back."}],tip:"\"Byline? Cut it back.\""},
        {section:"💚 Respect",q:"An opponent fouls you hard. What do you do?",opts:[
          {t:"Get up, let the referee deal with it, and focus",c:true,f:"Respect — and a clear head."},
          {t:"Get them back",c:false,f:"That's a card for you."},
          {t:"Argue with the referee",c:false,f:"Let the referee deal with it."},
          {t:"Walk off",c:false,f:"Stay and focus."}],tip:"\"Control what you can control.\""},
      ],
      intermediate:[
        {section:"🔴 Out of Possession",q:"Which of these is a good pressing trigger?",diagram:"Trigger",opts:[
          {t:"A bad touch, or a player facing their own goal",c:true,f:"Yes — press together when they're in trouble."},
          {t:"Their keeper's first touch every time",c:false,f:"Press on a trigger, not all the time."},
          {t:"Whenever you feel like it",c:false,f:"Together, on a trigger."},
          {t:"When they're on the counter-attack",c:false,f:"Then it's time to recover."}],tip:"\"Press on the trigger, as one.\""},
        {section:"🔴 Out of Possession",q:"Your centre back partner steps out to press. What do you do?",diagram:"Cover",opts:[
          {t:"Drop in behind to cover",c:true,f:"Yes — press and cover."},
          {t:"Step out too",c:false,f:"Then there's nobody behind."},
          {t:"Go up front",c:false,f:"Cover behind your partner."},
          {t:"Stay level with them",c:false,f:"A little behind, to cover."}],tip:"\"Press and cover.\""},
        {section:"⚽ In Possession",q:"Our winger stays wide on the touchline. How should the full back join the attack?",diagram:"Underlap",opts:[
          {t:"Underlap — run inside the winger",c:true,f:"Yes — overlap when they come inside, underlap when they stay wide."},
          {t:"Overlap on the outside",c:false,f:"The winger is already there — go inside."},
          {t:"Stand behind the winger",c:false,f:"Underlap."},
          {t:"Go in goal",c:false,f:"Underlap inside."}],tip:"\"Wide winger? Underlap.\""},
        {section:"⚽ In Possession",q:"What's a third-man run?",diagram:"ThirdMan",opts:[
          {t:"A pass into one player who lays it off to a third already running",c:true,f:"Yes — pass, lay-off, run."},
          {t:"Any run by the number 3",c:false,f:"It's about three players linking."},
          {t:"A run back into defence",c:false,f:"A run beyond, to receive the lay-off."},
          {t:"Three passes back to the keeper",c:false,f:"Pass, lay-off, run!"}],tip:"\"Pass, lay-off, run.\""},
        {section:"⚽ In Possession",q:"We're attacking. Why do the centre backs and holding mid stay back?",diagram:"Rest",opts:[
          {t:"Rest defence — to stop a counter if we lose it",c:true,f:"Yes — attack with balance."},
          {t:"They're not allowed forward",c:false,f:"They can be — just not all at once."},
          {t:"To rest their legs",c:false,f:"It's about protecting against the counter."},
          {t:"To be nearer the keeper",c:false,f:"To stop the counter-attack."}],tip:"\"Attack with balance.\""},
        {section:"⚽ In Possession",q:"Why should our striker stay between their centre backs?",diagram:"Pin",opts:[
          {t:"To pin them, so space opens for others",c:true,f:"Yes — busy centre backs can't step out."},
          {t:"To avoid the ball",c:false,f:"To pin them and create space."},
          {t:"Because that's offside",c:false,f:"It's about pinning them."},
          {t:"To be near the corner flag",c:false,f:"Between the centre backs!"}],tip:"\"Pin them.\""},
        {section:"📏 Rules",q:"Can you be offside from a goal kick?",opts:[
          {t:"No",c:true,f:"Right — no offside from goal kicks, throw-ins or corners."},
          {t:"Yes",c:false,f:"Not from a goal kick."},
          {t:"Only past halfway",c:false,f:"Never from a goal kick."},
          {t:"Only in the second half",c:false,f:"Never from a goal kick."}],tip:"\"No offside from goal kicks.\""},
        {section:"⚽ In Possession",q:"A cross is coming from the right. Where should the striker usually attack?",diagram:"NearPost",opts:[
          {t:"The near post",c:true,f:"Yes — someone else fills the far post."},
          {t:"Stand still on the penalty spot",c:false,f:"Move — attack the near post."},
          {t:"Behind the keeper",c:false,f:"Near post!"},
          {t:"The halfway line",c:false,f:"Get in the box!"}],tip:"\"Attack the near post.\""},
      ],
      expert:[
        {section:"📏 Rules",q:"You were in an offside position when the shot was taken, and score from the keeper's save. Offence?",diagram:"Offside",opts:[
          {t:"Yes — you gained an advantage from being offside",c:true,f:"Right — a rebound off the keeper doesn't reset it."},
          {t:"No — the keeper touched it",c:false,f:"A save doesn't reset offside."},
          {t:"Only if it's a penalty",c:false,f:"It's an offence — you gained an advantage."},
          {t:"Only in the first half",c:false,f:"It's an offence."}],tip:"\"A save doesn't make you onside.\""},
        {section:"🔴 Out of Possession",q:"Pressing high, why does the striker curve their run?",opts:[
          {t:"To block a pass to one side and force play where we want it",c:true,f:"Yes — press with a purpose."},
          {t:"To look good",c:false,f:"It's about cutting off a pass."},
          {t:"It's quicker",c:false,f:"It cuts off a passing lane."},
          {t:"To avoid the ball",c:false,f:"To cut off a pass and guide play."}],tip:"\"Curve the run, cut the lane.\""},
        {section:"⚽ In Possession",q:"Their back four is deep and organised. Best way to create a chance?",opts:[
          {t:"Move the ball quickly side to side to open a gap",c:true,f:"Yes — make them shift until a gap appears."},
          {t:"Shoot from 40 metres every time",c:false,f:"Work the ball to open a gap."},
          {t:"Give up and pass back",c:false,f:"Be patient and move them."},
          {t:"Dribble at all four",c:false,f:"Move the ball to move them."}],tip:"\"Move the ball, move them.\""},
        {section:"🔄 Transition",q:"We've just lost the ball and our press is beaten. What now?",diagram:"BackFour",opts:[
          {t:"Recover quickly behind the ball into our shape",c:true,f:"Yes — sprint back, then defend as a unit."},
          {t:"Keep pressing on your own",c:false,f:"Recover together."},
          {t:"Stop and wait",c:false,f:"Sprint back into shape."},
          {t:"Appeal to the referee",c:false,f:"Recover!"}],tip:"\"Beaten? Recover behind the ball.\""},
        {section:"⚽ In Possession",q:"As a winger, when should you cut inside rather than go outside?",diagram:"Invert",opts:[
          {t:"When the full back shows you inside and there's a shot on",c:true,f:"Read the defender and the space."},
          {t:"Always, every time",c:false,f:"Then you're easy to defend. Mix it up."},
          {t:"Never",c:false,f:"Cutting in to shoot is a big weapon."},
          {t:"Only on your weaker foot",c:false,f:"Usually onto your stronger foot."}],tip:"\"Read the full back.\""},
        {section:"🧤 Goalkeeper",q:"We're building from the back and they press. What should the keeper be?",opts:[
          {t:"An extra passer, calm on the ball",c:true,f:"Yes — 11 v 10 in the build."},
          {t:"Someone who only kicks long",c:false,f:"Long is fine sometimes, but be an option."},
          {t:"Hiding behind the defenders",c:false,f:"Be available."},
          {t:"In the other half",c:false,f:"Be an option in the build."}],tip:"\"Keepers are passers too.\""},
        {section:"🔴 Out of Possession",q:"Defending a corner, what's the most important thing?",opts:[
          {t:"Know your job — your player or your zone — and attack the ball",c:true,f:"Clear roles win set pieces."},
          {t:"Everyone stand on the goal line",c:false,f:"Know your job and attack the ball."},
          {t:"Watch only the ball",c:false,f:"Ball and your player or zone."},
          {t:"Go and stand in their half",c:false,f:"Defend the box first."}],tip:"\"Know your job, attack the ball.\""},
        {section:"💚 Respect",q:"We're 4–0 up. What's the right attitude?",opts:[
          {t:"Keep playing properly and respect the opponents",c:true,f:"Win well — no showboating."},
          {t:"Showboat and mess around",c:false,f:"Respect the opponents."},
          {t:"Stop trying",c:false,f:"Keep standards high."},
          {t:"Mock the other team",c:false,f:"Never. Win well."}],tip:"\"Win well, lose well.\""},
      ],
    },
    skills:[
      {id:"f11_ku50",cat:"⚽ Ball Mastery",name:"50 Kick-Ups",desc:"Feet, thighs and head — 50 in a row."},
      {id:"f11_firsttouch",cat:"⚽ Ball Mastery",name:"Directional First Touch",desc:"Receive from a wall and take your first touch away at an angle — 10 each side."},
      {id:"f11_aerial",cat:"⚽ Ball Mastery",name:"Aerial Control",desc:"Kick it high, control it with your chest or thigh, finish — 10 times."},
      {id:"f11_onetouch",cat:"🎯 Passing",name:"One-Touch Wall",desc:"One-touch passes against a wall, both feet — 30 in a row."},
      {id:"f11_driven",cat:"🎯 Passing",name:"Driven Switch",desc:"A 35-metre driven pass onto a target — 6 out of 10."},
      {id:"f11_scan",cat:"🎯 Passing",name:"Scan Count",desc:"Scan over each shoulder at least twice before every pass at training."},
      {id:"f11_moves",cat:"🏃 1v1",name:"Two Moves",desc:"Master two 1v1 moves and use both in a game or training."},
      {id:"f11_finish",cat:"🥅 Finishing",name:"Weaker Foot Finishing",desc:"20 finishes with your weaker foot into the corners."},
      {id:"f11_cutback",cat:"🥅 Finishing",name:"Cut-Back Finish",desc:"First-time finishes from a pulled-back pass — 10 times."},
      {id:"f11_sprint",cat:"💪 Fitness",name:"Repeat Sprints",desc:"8 × 30-metre sprints, 30 seconds' rest between each."},
      {id:"f11_core",cat:"💪 Fitness",name:"Core Circuit",desc:"Plank, side planks and glute bridges — 3 rounds."},
      {id:"f11_mobility",cat:"💪 Fitness",name:"Mobility",desc:"10 minutes of stretching and mobility after training."},
      {id:"f11_sleep",cat:"💪 Fitness",name:"Recovery",desc:"Get a good night's sleep before every game this week."},
      {id:"f11_analyse",cat:"🧠 Mindset",name:"Watch Your Position",desc:"Watch 15 minutes of a pro in your position — note three things they do off the ball."},
      {id:"f11_goal",cat:"🧠 Mindset",name:"Set a Goal",desc:"Set one goal for this week's game, and check it afterwards."},
      {id:"f11_lead",cat:"🧠 Mindset",name:"Lead by Example",desc:"Encourage a teammate after they make a mistake."},
    ],
    tips:[
      "Scan before you receive — know your next pass.",
      "Your first touch should set up your second.",
      "Play forward when it's on; keep it when it isn't.",
      "Press together, on a trigger.",
      "Lost it? Recover behind the ball.",
      "Attack with balance — keep a rest defence.",
      "Level with the second-last defender is onside.",
      "Wingers: read the full back before you choose.",
      "Byline? Cut it back.",
      "Strikers: attack the near post.",
      "Back four: shift together, no gaps.",
      "Keepers: call early and loud.",
      "Recovery matters — sleep, eat and drink well.",
      "Talk on the pitch — it wins games.",
      "Win well, lose well.",
    ],
  };
})();

/* ── Applying a format ── */
// what the page itself has (7v7), kept to put back
const HUB_7V7 = {
  skills: SKILLS.slice(),
  tips: TIPS.slice(),
  quiz: { beginner: LEVELS.beginner.questions, intermediate: LEVELS.intermediate.questions, expert: LEVELS.expert.questions },
  shape: "2-3-1",
};
var HUB_FMT = "7v7";

function fmtData(){ return HUB_FORMATS[HUB_FMT] || null; }

function applyHubFormat(f){
  if(!f || (f !== "7v7" && !HUB_FORMATS[f])) f = "7v7";
  HUB_FMT = f;
  const data = fmtData();
  // 7v7 has two shapes (the team's, set in Settings; Learning Positions, the Tactical Guide and the quiz follow it)
  const is321 = !data && saved7v7Shape() === "3-2-1";
  const shape = data ? data.shape : is321 ? "3-2-1" : HUB_7V7.shape;
  // the quiz, challenges and tips
  const quiz = data ? data.quiz : is321 ? QUIZ_321 : HUB_7V7.quiz;
  ["beginner","intermediate","expert"].forEach(function(lv){ LEVELS[lv].questions = quiz[lv]; });
  SKILLS.splice(0, SKILLS.length, ...(data ? data.skills : HUB_7V7.skills));
  TIPS.splice(0, TIPS.length, ...(data ? data.tips : HUB_7V7.tips));
  if(data) Object.keys(data.diagrams).forEach(function(k){ D["f"+f+"_"+k] = data.diagrams[k]; });
  // words that name the format
  document.querySelectorAll(".fmt-shape").forEach(function(e){ e.textContent = f + " · " + shape; });
  document.querySelectorAll(".fmt-name").forEach(function(e){ e.textContent = f; });
  document.querySelectorAll(".lev-count").forEach(function(e){ e.textContent = String(LEVELS[e.dataset.level].questions.length); });
  const tip = document.getElementById("tod-text");
  if(tip && TIPS.length) tip.textContent = TIPS[Math.floor(Date.now()/86400000) % TIPS.length];
  if(typeof refreshHomeProgress === "function") refreshHomeProgress();
  // the guide and positions are drawn when opened
  const gen = document.getElementById("guide-gen"); if(gen) gen.remove();
  const pos = document.getElementById("pos-gen"); if(pos) pos.remove();
}

/* the quiz's diagram names, per format, so 7v7's own names still work */
function fq(list, f){ return list.map(function(q){ return q.diagram ? Object.assign({}, q, { diagram: "f"+f+"_"+q.diagram }) : q; }); }
["5v5","9v9","11v11"].forEach(function(f){
  const q = HUB_FORMATS[f].quiz;
  ["beginner","intermediate","expert"].forEach(function(lv){ q[lv] = fq(q[lv], f); });
});

/* ── The guide, for a format other than 7v7 ── */
function genCard(card){
  const d = guideData();
  const wrap = document.createElement("div");
  wrap.className = "card"; wrap.dataset.pos = card.cat;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "pitch");
  wrap.appendChild(svg);
  d.diagrams[card.d](svg);
  const body = document.createElement("div");
  body.className = "card-body";
  const cat = d.guideCats.find(function(c){ return c.id === card.cat; });
  body.innerHTML = '<div class="card-title"><span class="pos-badge" style="background:'+cat.bg+';color:white;margin-left:0">'+cat.name+'</span> '+card.title+'</div><div class="card-desc">'+card.text+'</div>';
  wrap.appendChild(body);
  const key = document.createElement("div");
  key.className = "legend";
  key.innerHTML = '<span class="legend-item"><span class="legend-dot us"></span>Us</span><span class="legend-item"><span class="legend-dot opp"></span>Them</span><span class="legend-item" style="color:#f9a825">&rarr; Pass</span><span class="legend-item" style="color:#4caf50">&#8674; Run</span>';
  wrap.appendChild(key);
  return wrap;
}
function genGuide(){
  const d = guideData();
  let gen = document.getElementById("guide-gen");
  if(!gen){
    gen = document.createElement("div");
    gen.id = "guide-gen";
    const counts = {};
    d.guide.forEach(function(c){ counts[c.cat] = (counts[c.cat] || 0) + 1; });
    gen.innerHTML =
      '<div class="guide-head"><h1>How We Play</h1>'+
      '<p><span class="team-age">'+((document.querySelector(".team-age") || {}).textContent || "")+'</span>'+d.label+' &middot; '+d.shape+'</p></div>'+
      '<div class="guide-menu" id="guide-gen-cats"></div>'+
      '<div id="guide-gen-cards" style="display:none"><div class="section-cards" id="guide-gen-list" style="padding-top:12px"></div></div>';
    buildGuideMenu(gen.querySelector("#guide-gen-cats"), d.guideCats, counts, genGuidePos);
    const list = gen.querySelector("#guide-gen-list");
    d.guide.forEach(function(c){ list.appendChild(genCard(c)); });
    const topbar = document.querySelector("#app-guide .guide-topbar");
    topbar.after(gen);
  }
  return gen;
}
function genGuideHome(){
  const gen = genGuide();
  document.getElementById("guide-cat-home").style.display = "none";
  document.getElementById("guide-content").style.display = "none";
  document.getElementById("guide-glossary").style.display = "none";
  gen.style.display = "block";
  gen.querySelector(".guide-head").style.display = "";
  gen.querySelector("#guide-gen-cats").style.display = "";
  gen.querySelector("#guide-gen-cards").style.display = "none";
  const btn = document.querySelector("#app-guide .back-btn");
  btn.innerHTML = "&larr; Home"; btn.onclick = showAppHome;
  document.querySelector(".guide-topbar-title").textContent = "Tactical Guide";
  window.scrollTo(0,0);
}
function genGuidePos(cat){
  const d = guideData();
  const gen = genGuide();
  gen.querySelector(".guide-head").style.display = "none";
  gen.querySelector("#guide-gen-cats").style.display = "none";
  gen.querySelector("#guide-gen-cards").style.display = "block";
  gen.querySelectorAll("#guide-gen-list .card").forEach(function(c){ c.style.display = (cat === "all" || c.dataset.pos === cat) ? "" : "none"; });
  const btn = document.querySelector("#app-guide .back-btn");
  btn.innerHTML = "&larr; Back"; btn.onclick = genGuideHome;
  const c = d.guideCats.find(function(x){ return x.id === cat; });
  document.querySelector(".guide-topbar-title").textContent = c ? c.name : "All Cards";
  window.scrollTo(0,0);
}

/* ── Learning Positions, for a format other than 7v7 ── */
function genPositions(){
  const d = fmtData();
  let gen = document.getElementById("pos-gen");
  if(gen) return gen;
  const p = d.positions;
  gen = document.createElement("div");
  gen.id = "pos-gen";
  gen.innerHTML =
    '<div class="pos-learn-hero"><div class="pos-learn-badge">'+d.label+' &middot; '+d.shape+' Formation</div><h1>Learning Positions</h1><p>'+p.intro+'</p></div>'+
    '<div class="section-wrapper"><div class="section-header">&#x1F4D0; Our Shape &mdash; '+d.shape+'</div><div class="section-cards"><div class="card" id="pos-gen-shape"></div></div></div>'+
    '<div class="section-wrapper"><div class="section-header">&#x1F4CD; Each Position</div><div class="section-cards" id="pos-gen-roles"></div></div>';
  const shapeCard = gen.querySelector("#pos-gen-shape");
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "pitch");
  shapeCard.appendChild(svg);
  buildPitch(svg);
  zone(svg, 2, 104, "rgba(21,101,192,0.18)");
  zone(svg, 214, 104, "rgba(198,40,40,0.14)");
  tx("DEFENSIVE", { x: 55, y: 14, "text-anchor": "middle", fill: "rgba(255,255,255,0.7)", "font-size": 8, "font-family": "Nunito,sans-serif", "font-weight": 800 }, svg);
  tx("ATTACKING", { x: 265, y: 14, "text-anchor": "middle", fill: "rgba(255,255,255,0.7)", "font-size": 8, "font-family": "Nunito,sans-serif", "font-weight": 800 }, svg);
  team(svg, p.shape);
  const rule = document.createElement("div");
  rule.className = "card-body";
  rule.innerHTML = '<div class="pos-zone-rule">'+p.rule+'</div>';
  shapeCard.appendChild(rule);
  const roles = gen.querySelector("#pos-gen-roles");
  const colour = { gk: "#f9a825", us: "#1b5e20", hi_mid: "#1565c0", hi_wide: "#6a1b9a", hi_st: "#e65100" };
  p.roles.forEach(function(r){
    const c = document.createElement("div");
    c.className = "card";
    const t = roleType(r.l);
    c.innerHTML = '<div class="card-body"><div class="card-title"><span class="pos-badge" style="background:'+colour[t]+';color:'+(t==="gk"?"#1a1a1a":"white")+';margin-left:0">'+r.l+'</span> '+r.name+'</div>'+
      '<div class="card-desc"><strong>Your zone:</strong> '+r.zone+'<br><strong>With the ball:</strong> '+r.have+'<br><strong>Without it:</strong> '+r.not+'</div></div>';
    roles.appendChild(c);
  });
  document.querySelector("#app-positions .pos-learn-topbar").after(gen);
  return gen;
}

/* ── Learning Positions, 7v7's other shape: the 3-2-1 with wing backs ── */
// its drawings, shared by Learning Positions and the Tactical Guide
const B321 = [[18,100,"GK"],[82,26,"LWB"],[58,100,"CB"],[82,174,"RWB"],[135,72,"CM"],[135,128,"CM"],[228,100,"ST"]];
const G321 = {
  Attack(s){buildPitch(s);
    team(s,[[18,100,"GK"],[82,26,"LWB"],[80,100,"CB"],[82,174,"RWB"],[135,72,"CM"],[135,128,"CM"],[232,100,"ST"]]);
    opp(s,[[262,62],[262,138],[302,100,"GK"]]);B(s,96,104);
    run(s,82,26,205,18);run(s,82,174,205,182);pass(s,98,100,128,78);
    Lbl(s,205,40,"WIDE & HIGH",undefined,undefined,64);Lbl(s,205,160,"WIDE & HIGH",undefined,undefined,64);},
  Defend(s){buildPitch(s);
    team(s,[[18,100,"GK"],[70,42,"LWB"],[55,100,"CB"],[70,158,"RWB"],[108,78,"CM"],[108,122,"CM"],[168,100,"ST"]]);
    opp(s,[[200,55],[196,120],[230,150],[302,100,"GK"]]);B(s,188,55);
    run(s,190,22,72,40);run(s,190,178,72,156);
    Lbl(s,62,190,"BACK THREE",undefined,undefined,64);},
  Balance(s){buildPitch(s);
    team(s,[[18,100,"GK"],[200,22,"LWB"],[66,82,"CB"],[86,140,"RWB"],[150,62,"CM"],[120,118,"CM"],[232,100,"ST"]]);
    opp(s,[[240,40],[262,130],[302,100,"GK"]]);B(s,212,28);
    run(s,90,174,86,152);
    Lbl(s,104,178,"TUCK IN",undefined,undefined,52);},
  Shape(s){buildPitch(s);team(s,B321);},
  Press(s){buildPitch(s);
    team(s,[[18,100,"GK"],[120,30,"LWB"],[90,100,"CB"],[120,170,"RWB"],[148,96,"CM"],[160,135,"CM"],[228,100,"ST"]]);
    opp(s,[[200,58],[262,40],[262,150],[302,100,"GK"]]);B(s,190,66);
    run(s,148,96,182,72);run(s,228,100,206,72);run(s,120,30,86,40);run(s,120,170,86,160);
    Lbl(s,215,140,"WIN IT BACK",undefined,undefined,60);},
  Switch(s){buildPitch(s);
    team(s,[[18,100,"GK"],[182,22,"LWB"],[75,100,"CB"],[175,175,"RWB"],[135,72,"CM"],[135,128,"CM"],[232,100,"ST"]]);
    opp(s,[[208,42],[215,82],[190,112],[302,100,"GK"]]);B(s,170,32);
    pass(s,170,32,143,62);pass(s,138,84,172,162);
    Lbl(s,236,160,"SWITCH IT",undefined,undefined,56);},
  GKOut(s){buildPitch(s);
    team(s,[[18,100,"GK"],[70,24,"LWB"],[55,100,"CB"],[70,176,"RWB"],[120,72,"CM"],[120,128,"CM"],[200,100,"ST"]]);
    opp(s,[[105,100],[100,45],[302,100,"GK"]]);B(s,30,112);
    pass(s,30,112,64,164);
    Lbl(s,125,168,"ROLL IT WIDE",undefined,undefined,64);},
  GKTalk(s){buildPitch(s);
    team(s,[[18,100,"GK"],[66,45,"LWB"],[55,100,"CB"],[66,155,"RWB"],[105,78,"CM"],[105,122,"CM"],[170,100,"ST"]]);
    opp(s,[[152,58],[160,135],[200,95],[302,100,"GK"]]);B(s,141,63);
    Lbl(s,70,190,"TALK & ORGANISE",undefined,undefined,84);},
  Cover(s){buildPitch(s);
    team(s,[[18,100,"GK"],[190,22,"LWB"],[58,100,"CB"],[82,160,"RWB"],[150,85,"CM"],[135,130,"CM"],[235,100,"ST"]]);
    opp(s,[[130,38],[200,110],[302,100,"GK"]]);B(s,118,42);
    dribble(s,118,42,80,38);run(s,58,100,72,58);run(s,150,85,96,100);
    Lbl(s,40,22,"SLIDE ACROSS",undefined,undefined,64);},
  StepUp(s){buildPitch(s);
    team(s,[[18,100,"GK"],[150,25,"LWB"],[80,100,"CB"],[150,175,"RWB"],[175,75,"CM"],[175,125,"CM"],[240,100,"ST"]]);
    opp(s,[[265,70],[265,130],[302,100,"GK"]]);B(s,212,104);
    run(s,80,100,130,100);
    Lbl(s,105,126,"STEP UP",undefined,undefined,48);},
  WBHigh(s){buildPitch(s);
    team(s,[[18,100,"GK"],[90,30,"LWB"],[90,100,"CB"],[110,170,"RWB"],[150,80,"CM"],[145,125,"CM"],[240,100,"ST"]]);
    opp(s,[[200,64],[262,90],[262,135],[302,100,"GK"]]);B(s,164,90);
    run(s,90,30,220,18);pass(s,164,88,215,24);
    Lbl(s,262,50,"STAY ON THE LINE",undefined,undefined,72);},
  Cross(s){buildPitch(s);
    team(s,[[18,100,"GK"],[282,24,"LWB"],[120,100,"CB"],[200,175,"RWB"],[236,88,"CM"],[190,130,"CM"],[262,122,"ST"]]);
    opp(s,[[250,38],[282,148],[302,100,"GK"]]);B(s,288,38);
    pass(s,288,40,246,80);run(s,262,122,284,108);
    Lbl(s,198,62,"CUT IT BACK",undefined,undefined,60);},
  Mids(s){buildPitch(s);
    team(s,[[18,100,"GK"],[150,24,"LWB"],[70,100,"CB"],[110,174,"RWB"],[140,70,"CM"],[130,125,"CM"],[235,100,"ST"]]);
    opp(s,[[265,70],[265,130],[302,100,"GK"]]);B(s,82,104);
    run(s,140,70,205,70);Lbl(s,205,48,"ONE GOES",undefined,undefined,52);Lbl(s,130,150,"ONE STAYS",undefined,undefined,54);},
  FeedWB(s){buildPitch(s);
    team(s,[[18,100,"GK"],[170,22,"LWB"],[60,100,"CB"],[82,174,"RWB"],[130,92,"CM"],[150,140,"CM"],[235,100,"ST"]]);
    opp(s,[[160,95],[262,70],[302,100,"GK"]]);B(s,72,104);
    pass(s,74,102,120,94);pass(s,134,84,164,32);
    Lbl(s,215,160,"OPEN UP, PLAY WIDE",undefined,undefined,96);},
  HoldUp(s){buildPitch(s);
    team(s,[[18,100,"GK"],[150,25,"LWB"],[90,100,"CB"],[150,175,"RWB"],[170,80,"CM"],[165,125,"CM"],[225,100,"ST"]]);
    opp(s,[[248,100],[270,60],[302,100,"GK"]]);B(s,213,104);
    run(s,150,25,228,25);run(s,150,175,228,175);
    Lbl(s,225,135,"HOLD IT UP",undefined,undefined,56);},
  LeadPress(s){buildPitch(s);
    team(s,[[170,80,"CM"],[170,120,"CM"],[200,30,"LWB"],[230,110,"ST"],[200,170,"RWB"]]);
    opp(s,[[268,90],[262,40],[262,160],[302,100,"GK"]]);B(s,280,88);
    run(s,234,108,262,96);A(s,276,92,264,48,"ar",true,1.5);
    Lbl(s,236,140,"CURVE YOUR RUN",undefined,undefined,80);},
};
// the Tactical Guide for the 3-2-1, drawn like the other formats' guides
const GUIDE_321 = {
  label:"7v7", shape:"3-2-1",
  diagrams:G321,
  guideCats:[
    {id:"team",name:"Team",icon:"👥",bg:"#37474f"},
    {id:"gk",name:"Goalkeeper",icon:"🧤",bg:"#e65100"},
    {id:"def",name:"Centre Back",icon:"🛡️",bg:"#1b5e20"},
    {id:"wb",name:"Wing Backs",icon:"⚡",bg:"#6a1b9a"},
    {id:"mid",name:"Centre Mids",icon:"🎯",bg:"#1565c0"},
    {id:"st",name:"Striker",icon:"⚽",bg:"#b71c1c"},
  ],
  guide:[
    {cat:"team",title:"Our Shape",d:"Shape",text:"Three at the back, two in the middle, one up front. The two wide defenders are <strong>wing backs</strong> — defenders without the ball, wingers with it."},
    {cat:"team",title:"Wide With the Ball",d:"Attack",text:"We've got it: <strong>both wing backs push up the touchlines</strong> and the CB steps up. Now we're big and wide."},
    {cat:"team",title:"Back Three Without It",d:"Defend",text:"We've lost it: <strong>wing backs sprint back level with the CB</strong>, and the CMs sit in front. No gaps through the middle."},
    {cat:"team",title:"Win It Back",d:"Press",text:"Just lost it? The <strong>nearest two press straight away</strong> while the wing backs race back into the back three."},
    {cat:"team",title:"Switch the Play",d:"Switch",text:"One side crowded? <strong>Wing back to CM to the other wing back</strong> — they'll have loads of space."},
    {cat:"gk",title:"Roll It Wide",d:"GKOut",text:"Caught it? Our wing backs are <strong>the free players out wide</strong>. Roll it to one quickly, before they get back."},
    {cat:"gk",title:"Organise the Back Three",d:"GKTalk",text:"You can see everything. <strong>Tell the wing backs to drop</strong> and tell the CB who to pick up."},
    {cat:"def",title:"Cover the Gap",d:"Cover",text:"A wing back has gone forward and they break down that side? <strong>Slide across to cover</strong> — a CM drops into your spot."},
    {cat:"def",title:"Step Up",d:"StepUp",text:"When the ball goes up the pitch, <strong>step up towards halfway</strong>. It keeps the team close together."},
    {cat:"wb",title:"Get Wide and High",d:"WBHigh",text:"With the ball, you're our winger. <strong>Stay right on the touchline</strong> so a CM can find you."},
    {cat:"wb",title:"Cut It Back",d:"Cross",text:"Got to the byline? <strong>Look for a cut-back</strong> to a CM arriving, or cross for the striker."},
    {cat:"wb",title:"Race Back",d:"Defend",text:"We've lost it? <strong>Sprint back level with the CB</strong>. A back three is only a back three if you get there."},
    {cat:"wb",title:"One Goes, One Stays",d:"Balance",text:"Ball on the other side? <strong>Tuck in next to the CB</strong> so we always keep two at the back. Talk to the other wing back!"},
    {cat:"mid",title:"One Goes, One Stays",d:"Mids",text:"If one CM <strong>goes forward</strong>, the other <strong>stays</strong> in front of the back three."},
    {cat:"mid",title:"Feed the Wing Backs",d:"FeedWB",text:"Take it from the CB with your <strong>body open</strong>, then play it out wide to a wing back."},
    {cat:"st",title:"Hold It Up",d:"HoldUp",text:"You're on your own up front. <strong>Keep the ball</strong> until the wing backs arrive, then play it wide."},
    {cat:"st",title:"Lead the Press",d:"LeadPress",text:"When their defender has it, <strong>curve your run</strong> to push them one way. The team follows your lead."},
  ],
};
// the How We Play quiz for the 3-2-1 (its diagrams are the guide's, as D.f321_*)
const QUIZ_321 = {
  beginner:[
    {section:"📍 Shape",q:"In our 3-2-1, how many defenders do we have when the other team has the ball?",diagram:"Shape",opts:[
      {t:"Two",c:false,f:"That's the 2-3-1. In the 3-2-1 there are three."},
      {t:"Three — the two wing backs and the CB",c:true,f:"Yes! LWB, CB and RWB make a back three."},
      {t:"Just the goalkeeper",c:false,f:"The keeper is behind three defenders."},
      {t:"Nobody — everyone attacks",c:false,f:"We always keep a back three when we don't have it."}],tip:"\"Three at the back, two in the middle, one up front.\""},
    {section:"⚽ In Possession",q:"We've just won the ball. What do the wing backs do?",diagram:"Attack",opts:[
      {t:"Stay next to the CB",c:false,f:"Then nobody gives us width. Get forward!"},
      {t:"Run into the middle",c:false,f:"The middle is the CMs' job. Stay wide."},
      {t:"Sprint up the touchlines to become wingers",c:true,f:"Exactly — wide and high, you're our wingers now."},
      {t:"Go in goal",c:false,f:"That's the keeper's job!"}],tip:"\"Wing backs: wide and high with the ball.\""},
    {section:"🔴 Out of Possession",q:"We've lost the ball. Where do the wing backs go?",diagram:"Defend",opts:[
      {t:"Sprint back level with the CB",c:true,f:"Yes! That makes our back three."},
      {t:"Stay up the pitch and wait",c:false,f:"Then the CB is on their own. Race back!"},
      {t:"Chase the ball wherever it goes",c:false,f:"Get back into the back three first."},
      {t:"Walk back slowly",c:false,f:"Sprint! A back three only works if you get there."}],tip:"\"Lose it? Wing backs race back.\""},
    {section:"🥅 Goalkeeper",q:"The keeper has caught it. Who's usually the free player to roll it to?",diagram:"GKOut",opts:[
      {t:"The striker, right up the other end",c:false,f:"Too far, and it's crowded. Look wide first."},
      {t:"A wing back out wide",c:true,f:"Yes — the wing backs are usually the free players."},
      {t:"Nobody — kick it out of play",c:false,f:"Keep it! Find a wing back or the CB."},
      {t:"An opponent",c:false,f:"Find a teammate!"}],tip:"\"Keeper: roll it wide, quickly.\""},
    {section:"⚽ Striker",q:"You're the striker, the ball comes to you and the wing backs aren't there yet. What do you do?",diagram:"HoldUp",opts:[
      {t:"Shoot from the halfway line",c:false,f:"Too far out. Keep the ball until help arrives."},
      {t:"Pass it back to the keeper",c:false,f:"Keep it up the pitch — hold it up."},
      {t:"Run into three defenders",c:false,f:"You're on your own. Wait for support."},
      {t:"Hold it up until they arrive, then play it wide",c:true,f:"Perfect — you're on your own up front, so keep it."}],tip:"\"Striker: hold it up for the wing backs.\""},
    {section:"⚽ Midfield",q:"One of our two CMs runs forward. What does the other one do?",diagram:"Mids",opts:[
      {t:"Runs forward too",c:false,f:"Then there's nobody in front of the defence."},
      {t:"Stays in front of the back three",c:true,f:"Yes — one goes, one stays."},
      {t:"Goes in goal",c:false,f:"Stay in midfield and protect the defence."},
      {t:"Runs out wide",c:false,f:"The wing backs are wide. You stay central."}],tip:"\"CMs: one goes, one stays.\""},
    {section:"⚡ Transition",q:"We've just lost the ball near their goal. What happens?",diagram:"Press",opts:[
      {t:"Everyone stops and walks back",c:false,f:"Win it back! The nearest players press."},
      {t:"Everyone chases the ball",c:false,f:"Only the nearest two — the wing backs recover."},
      {t:"The nearest two press while the wing backs race back",c:true,f:"That's it — press and recover at the same time."},
      {t:"The keeper runs up to help",c:false,f:"Keeper stays in goal!"}],tip:"\"Press near the ball, recover away from it.\""},
    {section:"📖 Glossary",q:"What is a wing back?",diagram:null,opts:[
      {t:"A defender who only stays in the box",c:false,f:"A wing back goes the whole length of the touchline."},
      {t:"A striker who plays wide",c:false,f:"Close, but a wing back defends too."},
      {t:"The keeper's helper",c:false,f:"Not quite!"},
      {t:"A wide defender who becomes a winger when we have the ball",c:true,f:"Yes — defender without the ball, winger with it."}],tip:"\"Wing backs do both jobs.\""},
  ],
  intermediate:[
    {section:"📍 Shape",q:"The ball is on the left and our left wing back has gone forward. What does the right wing back do?",diagram:"Balance",opts:[
      {t:"Tucks in next to the CB",c:true,f:"Yes — so we always keep two at the back."},
      {t:"Goes forward as well",c:false,f:"Then only the CB is left at the back."},
      {t:"Stays right out on the touchline",c:false,f:"Tuck in — the ball is on the other side."},
      {t:"Runs over to the left",c:false,f:"Stay on your side, but come narrower."}],tip:"\"One wing back goes, one stays.\""},
    {section:"⚽ In Possession",q:"The left side is crowded with players. What's the best move?",diagram:"Switch",opts:[
      {t:"Keep trying to dribble through",c:false,f:"Too crowded. Move it to the space."},
      {t:"Kick it out for a throw",c:false,f:"Keep it! There's space on the other side."},
      {t:"Switch it: wing back, to CM, to the other wing back",c:true,f:"Exactly — the far wing back will have loads of space."},
      {t:"Pass back to the keeper every time",c:false,f:"Sometimes, but the switch is better here."}],tip:"\"Crowded? Switch it.\""},
    {section:"🛡️ Defending",q:"Our left wing back is up the pitch and they break down that side. What does the CB do?",diagram:"Cover",opts:[
      {t:"Stays in the middle and watches",c:false,f:"Then they've got a free run at goal. Slide across."},
      {t:"Slides across to cover, and a CM drops into the middle",c:true,f:"Yes — that's how we cover the gap a wing back leaves."},
      {t:"Shouts at the wing back",c:false,f:"Talk, yes — but cover first!"},
      {t:"Goes forward to attack",c:false,f:"Defend first!"}],tip:"\"Cover the gap behind the wing back.\""},
    {section:"🛡️ Defending",q:"The ball has gone up to the other end. What does the CB do?",diagram:"StepUp",opts:[
      {t:"Stays on the edge of our box",c:false,f:"That leaves a big gap. Step up."},
      {t:"Runs into their box",c:false,f:"Too far! Halfway is enough."},
      {t:"Sits down for a rest",c:false,f:"Stay switched on!"},
      {t:"Steps up towards halfway",c:true,f:"Yes — it keeps the team close together."}],tip:"\"Step up when the ball goes up.\""},
    {section:"⚽ In Possession",q:"You're the left wing back and we have the ball. Where do you stand?",diagram:"WBHigh",opts:[
      {t:"Wide and high, on the touchline",c:true,f:"Yes — so a CM can find you in space."},
      {t:"Next to the CB",c:false,f:"That's where you go without the ball."},
      {t:"In the middle, next to the striker",c:false,f:"Too narrow. Width is your job."},
      {t:"Behind the keeper",c:false,f:"Get forward!"}],tip:"\"Wing backs: stay on the line.\""},
    {section:"⚽ Midfield",q:"A CM gets the ball from the CB. What's a good next move?",diagram:"FeedWB",opts:[
      {t:"Turn your back to the pitch",c:false,f:"Open your body so you can see forward."},
      {t:"Open your body and play it out wide to a wing back",c:true,f:"Yes — the wing backs are your best friends."},
      {t:"Pass straight back to the CB every time",c:false,f:"Sometimes, but look forward and wide first."},
      {t:"Shoot from your own half",c:false,f:"Too far out!"}],tip:"\"CMs: feed the wing backs.\""},
    {section:"🥅 Goalkeeper",q:"They're attacking. What's the keeper's big job in a 3-2-1?",diagram:"GKTalk",opts:[
      {t:"Stay quiet and concentrate",c:false,f:"Talk! You can see everything."},
      {t:"Run out to the halfway line",c:false,f:"Stay where you can save it."},
      {t:"Tell the wing backs to drop and tell the CB who to pick up",c:true,f:"Exactly — organise the back three."},
      {t:"Watch the crowd",c:false,f:"Eyes on the game!"}],tip:"\"Keeper: talk and organise.\""},
    {section:"⚽ Striker",q:"Their defender has the ball. What does our striker do?",diagram:"LeadPress",opts:[
      {t:"Stand still",c:false,f:"Lead the press!"},
      {t:"Run straight at them as fast as you can",c:false,f:"Close — but curve your run."},
      {t:"Run back to our box",c:false,f:"Stay up and press."},
      {t:"Curve your run to push them one way",c:true,f:"Yes — the team follows your lead."}],tip:"\"Striker: curve your run.\""},
  ],
  expert:[
    {section:"📍 Shape",q:"Where is the 3-2-1's weak spot?",diagram:"Cover",opts:[
      {t:"The space behind a wing back who has gone forward",c:true,f:"Yes — that's why the CB and a CM slide across to cover it."},
      {t:"In front of their goal",c:false,f:"That's where we want to be!"},
      {t:"There isn't one",c:false,f:"Every shape has one. Know where it is!"},
      {t:"Behind the striker",c:false,f:"Our CMs are there."}],tip:"\"Know the weak spot and cover it.\""},
    {section:"⚽ In Possession",q:"Our left wing back is on the byline and their defenders are back in the box. What's the best ball?",diagram:"Cross",opts:[
      {t:"A high cross into the crowd",c:false,f:"Their defenders are facing it. Look for a better option."},
      {t:"A cut-back to a CM arriving",c:true,f:"Yes — they're running onto it, facing goal."},
      {t:"Pass it back to the keeper",c:false,f:"We're nearly there — be brave!"},
      {t:"Shoot from the byline",c:false,f:"There's no angle. Cut it back."}],tip:"\"At the byline? Cut it back.\""},
    {section:"📍 Shape",q:"When both wing backs push on with the ball, what shape do we turn into?",diagram:"Attack",opts:[
      {t:"A 3-2-1 still",c:false,f:"With the wing backs up, it's a different shape."},
      {t:"All seven in a line",c:false,f:"Not quite!"},
      {t:"A 1-4-1: CB, then wing backs and CMs across, then the striker",c:true,f:"Yes — four across the middle when we attack."},
      {t:"A 5-0-1",c:false,f:"That's very defensive. We push on!"}],tip:"\"Three at the back without it, four across with it.\""},
    {section:"📍 Shape",q:"Why shouldn't both wing backs go forward when we might lose the ball?",diagram:"Balance",opts:[
      {t:"They'd get too tired",c:false,f:"Maybe, but there's a bigger problem."},
      {t:"It's against the rules",c:false,f:"It's allowed — it's just risky."},
      {t:"They'd block the striker",c:false,f:"Not really. Think about our defence."},
      {t:"Only the CB would be left at the back if we lose it",c:true,f:"Exactly — always keep two at the back."}],tip:"\"Never both up when we could lose it.\""},
    {section:"🔴 Out of Possession",q:"Without the ball, why do the two CMs sit just in front of the back three?",diagram:"Defend",opts:[
      {t:"To stop passes through the middle",c:true,f:"Yes — no gaps between midfield and defence."},
      {t:"To be nearer the striker",c:false,f:"The striker is the other way!"},
      {t:"So they can rest",c:false,f:"They're working hard!"},
      {t:"To take throw-ins",c:false,f:"Not their job here."}],tip:"\"Stay close — no gaps through the middle.\""},
    {section:"📍 Shape",q:"Compared with our 2-3-1, what's the big change in the 3-2-1?",diagram:null,opts:[
      {t:"No goalkeeper",c:false,f:"Always a keeper!"},
      {t:"Two strikers",c:false,f:"Still one striker."},
      {t:"One more defender, one fewer midfielder — and the width comes from the wing backs",c:true,f:"Yes — the wide players start as defenders."},
      {t:"Nothing changes",c:false,f:"The shape is quite different."}],tip:"\"Wing backs do the width.\""},
    {section:"⚡ Transition",q:"We've lost the ball. Why do only the nearest two press, not everyone?",diagram:"Press",opts:[
      {t:"The others are lazy",c:false,f:"No — they have another job."},
      {t:"The wing backs need to race back so we aren't caught out",c:true,f:"Yes — press near the ball, recover away from it."},
      {t:"Pressing isn't allowed",c:false,f:"It is!"},
      {t:"Everyone should press",c:false,f:"Then nobody's protecting our goal."}],tip:"\"Press and recover together.\""},
  ],
};
["beginner","intermediate","expert"].forEach(function(lv){ QUIZ_321[lv] = fq(QUIZ_321[lv], "321"); });
// the question shows just where everyone is; the answer shows the arrows and words too
Object.keys(G321).forEach(function(k){
  D["f321_"+k] = function(s){
    const A0 = A, Lbl0 = Lbl;
    A = Lbl = function(){};
    try { G321[k](s); } finally { A = A0; Lbl = Lbl0; }
  };
  DG["f321_"+k] = G321[k];
});

const SHAPE_321 = {
  intro:"Three at the back, two in the middle, one up front — but the two wide defenders are <strong>wing backs</strong>: defenders without the ball, wide midfielders with it.",
  cards:[
    {title:"The 3-2-1 — Know Your Zone",draw:function(s){
      zone(s,2,104,"rgba(21,101,192,0.18)");zone(s,214,104,"rgba(198,40,40,0.14)");
      team(s,[[18,100,"GK"],[82,26,"LWB"],[58,100,"CB"],[82,174,"RWB"],[135,72,"CM"],[135,128,"CM"],[228,100,"ST"]]);},
     text:"<strong>1 Goalkeeper &middot; 3 Defenders (LWB, CB, RWB) &middot; 2 Centre Mids &middot; 1 Striker.</strong> The CB and the two CMs are the safe middle; the wing backs give us all our width, so they cover the whole touchline.",
     rules:["<strong>Weak spot:</strong> the space behind a wing back who has gone forward. The CB and the nearest CM slide across to cover it."],
     key:'<span class="legend-item"><span class="legend-dot us"></span>Defenders &amp; wing backs</span><span class="legend-item"><span class="legend-dot" style="background:#1565c0;border-color:#0d47a1"></span>CMs</span><span class="legend-item"><span class="legend-dot" style="background:#e65100;border-color:#bf360c"></span>ST</span>'},
    {title:"With the Ball — Wing Backs Push On",draw:G321.Attack,
     text:"When we win it, <strong>both wing backs sprint up the touchlines</strong> to become wingers. Now it's a 1-4-1 going forward: the CB steps up towards halfway and the two CMs link it all together.",
     rules:["<strong>Striker:</strong> hold the ball up until the wing backs arrive, then play it wide.","<strong>Switch it:</strong> one side crowded? Wing back to CM to the other wing back."],
     key:'<span class="legend-item"><span class="legend-dot us"></span>Us</span><span class="legend-item"><span class="legend-dot opp"></span>Them</span><span class="legend-item" style="color:#f9a825">&rarr; Pass</span><span class="legend-item" style="color:#4caf50">&#8674; Run</span>'},
    {title:"Without the Ball — Back Three",draw:G321.Defend,
     text:"When we lose it, <strong>the wing backs sprint back level with the CB</strong> to make a back three. The two CMs sit just in front of them, so there's no gap through the middle.",
     rules:["<strong>Striker:</strong> stay near halfway and press their defender, ready for the counter."],
     key:'<span class="legend-item"><span class="legend-dot us"></span>Us</span><span class="legend-item"><span class="legend-dot opp"></span>Them</span><span class="legend-item" style="color:#4caf50">&#8674; Recovery run</span>'},
    {title:"One Goes, One Stays",draw:G321.Balance,
     text:"Ball on the left? The <strong>left wing back goes</strong>, the <strong>right wing back tucks in</strong> next to the CB, so we always keep two at the back. Same with the CMs: if one goes forward, the other stays.",
     rules:["<strong>Talk:</strong> wing backs, tell each other who's going. Never both up when we could lose it."],
     key:'<span class="legend-item"><span class="legend-dot us"></span>Us</span><span class="legend-item"><span class="legend-dot opp"></span>Them</span><span class="legend-item" style="color:#4caf50">&#8674; Run</span>'},
  ],
  roles:[
    {l:"GK",name:"Goalkeeper",zone:"The box, and behind the back three.",have:"Roll it out to a wing back in space, or to the CB.",not:"Talk to the back three — tell them when to drop and who to pick up."},
    {l:"LWB",name:"Left Wing Back",zone:"The whole left touchline, box to box.",have:"Get wide and high — you're our winger now. Cross, or pass inside to a CM.",not:"Sprint back level with the CB. If the ball's on the right, tuck in."},
    {l:"CB",name:"Centre Back",zone:"The middle of our half.",have:"Step up towards halfway; pass to a wing back or a CM. Carry it in if there's space.",not:"Pick up their striker and cover behind whichever wing back has gone."},
    {l:"RWB",name:"Right Wing Back",zone:"The whole right touchline, box to box.",have:"Get wide and high — you're our winger now. Cross, or pass inside to a CM.",not:"Sprint back level with the CB. If the ball's on the left, tuck in."},
    {l:"CM",name:"Centre Mids (two)",zone:"The middle of the pitch, both halves.",have:"One goes, one stays. Get on the half-turn and switch it from wing back to wing back.",not:"Sit in front of the back three, and slide across to fill the gap a wing back leaves."},
    {l:"ST",name:"Striker",zone:"Their half, between their defenders.",have:"Hold it up until the wing backs arrive; run in behind.",not:"Press their defenders — curve your run to push them one way."},
  ],
};
function gen321(){
  let gen = document.getElementById("shape-321");
  if(gen) return gen;
  gen = document.createElement("div");
  gen.id = "shape-321";
  gen.innerHTML = '<div class="section-wrapper"><div class="section-header">&#x1F4D0; 7v7 Shape &mdash; 3-2-1 with Wing Backs</div><div class="section-cards" id="shape-321-cards"></div></div>'+
    '<div class="section-wrapper"><div class="section-header">&#x1F4CD; Each Position</div><div class="section-cards" id="shape-321-roles"></div></div>'+
    '<div class="guide-footer">7v7 positional zone guide &middot; 3-2-1 formation</div>';
  const cards = gen.querySelector("#shape-321-cards");
  SHAPE_321.cards.forEach(function(c, i){
    const card = document.createElement("div");
    card.className = "card";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "pitch");
    card.appendChild(svg);
    buildPitch(svg); c.draw(svg);
    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = '<div class="card-title">'+c.title+'</div><div class="card-desc">'+(i === 0 ? SHAPE_321.intro+'<br><br>' : '')+c.text+'</div>'+
      c.rules.map(function(r){ return '<div class="pos-zone-rule">'+r+'</div>'; }).join("");
    card.appendChild(body);
    const key = document.createElement("div");
    key.className = "legend"; key.innerHTML = c.key;
    card.appendChild(key);
    cards.appendChild(card);
  });
  const roles = gen.querySelector("#shape-321-roles");
  const colour = { gk: "#f9a825", us: "#1b5e20", hi_mid: "#1565c0", hi_wide: "#6a1b9a", hi_st: "#e65100" };
  SHAPE_321.roles.forEach(function(r){
    const c = document.createElement("div");
    c.className = "card";
    const t = roleType(r.l);
    c.innerHTML = '<div class="card-body"><div class="card-title"><span class="pos-badge" style="background:'+colour[t]+';color:'+(t==="gk"?"#1a1a1a":"white")+';margin-left:0">'+r.l+'</span> '+r.name+'</div>'+
      '<div class="card-desc"><strong>Your zone:</strong> '+r.zone+'<br><strong>With the ball:</strong> '+r.have+'<br><strong>Without it:</strong> '+r.not+'</div></div>';
    roles.appendChild(c);
  });
  document.getElementById("app-positions").appendChild(gen);
  return gen;
}
/** Learning Positions for the 7v7 shape: the page's own 2-3-1, or the 3-2-1. */
function show7v7Shape(shape){
  const is321 = shape === "3-2-1";
  const own = gen321();
  Array.from(document.getElementById("app-positions").children).forEach(function(c){
    if(c.classList.contains("pos-learn-topbar") || c.classList.contains("pos-learn-hero") || c.id === "pos-gen") return;
    c.style.display = (c === own) === is321 ? "" : "none";
  });
  document.querySelector("#app-positions > .pos-learn-hero .pos-learn-badge").textContent = "7v7 · " + shape + " Formation";
}
/** A 7v7 team's shape, as the club set it (Coach Admin → Settings → the team's formation). */
let HUB_7V7_SHAPE = "2-3-1";
function saved7v7Shape(){ return HUB_7V7_SHAPE; }
/** The guide to draw: another format's, the 3-2-1's, or none (the page's own 2-3-1). */
function guideData(){ return fmtData() || (saved7v7Shape() === "3-2-1" ? GUIDE_321 : null); }

/* ── Hooks into the page's own screens ── */
(function(){
  const showGuide0 = showGuide, showGuideCatHome0 = showGuideCatHome, showGuidePos0 = showGuidePos, showGlossary0 = showGlossary, showPositions0 = showPositions;
  const hideGen = function(){ const g = document.getElementById("guide-gen"); if(g) g.style.display = "none"; };
  showGuide = function(){ showGuide0(); if(guideData()) genGuideHome(); else hideGen(); };
  showGuideCatHome = function(){ if(guideData()) genGuideHome(); else { hideGen(); showGuideCatHome0(); } };
  showGuidePos = function(pos){ hideGen(); showGuidePos0(pos); };
  showGlossary = function(){ hideGen(); showGlossary0(); if(guideData()){ const b = document.querySelector("#app-guide .back-btn"); b.onclick = genGuideHome; } };
  showPositions = function(){
    showPositions0();
    const data = fmtData();
    const gen = data ? genPositions() : null;
    // the page's own 7v7 positions, or this format's
    Array.from(document.getElementById("app-positions").children).forEach(function(c){
      if(c.classList.contains("pos-learn-topbar")) return;
      if(c.id === "pos-gen") c.style.display = data ? "" : "none";
      else c.style.display = data ? "none" : "";
    });
    if(gen) gen.style.display = "";
    else show7v7Shape(saved7v7Shape());
  };
})();

/* ── The format: always the club's ── */
/** The player's team's format and 7v7 shape, as the club set them (Coach Admin → Settings → the team). Players can't change them. */
function chooseHubFormat(teamFormat, teamShape){
  // an age group or shape once picked on a phone (earlier versions let players choose) no longer counts
  try { localStorage.removeItem("hub_format"); localStorage.removeItem("hub_format_team"); localStorage.removeItem("hub_7v7_shape"); } catch(e){}
  HUB_7V7_SHAPE = teamShape === "3-2-1" ? "3-2-1" : "2-3-1";
  applyHubFormat(teamFormat || "7v7");
}
