# Card Layout Image Prompt Pack

Purpose: exact question screens to generate card images for the remaining old-text follow-up questions.

## Cross-check Summary

### Already Converted To Latest Card Layout

Core pre-consult screens (modern card UI):
1. Safety first
2. Primary reason for this consultation
3. Where does it hurt?
4. Which side is most affected?
5. How long have you had this problem?
6. How did this problem start?
7. How strong is the pain right now?
8. Which best describes your pain pattern?
9. How is your condition changing overall?
10. Do you have radiating pain into your arm or leg?
11. Numbness or tingling in arm, hand, leg, or foot?
12. Pain worsens with (select all that apply)
13. Pain improves with (select all that apply)
14. Treatments tried so far (select all that apply)
15. Has treatment helped?

Legacy follow-up screens already cardized:
1. NDI 1. Pain intensity
2. NDI 2. Personal care
3. NDI 3. Lifting
4. NDI 4. Reading
5. NDI 5. Headaches
6. NDI 6. Concentration
7. NDI 7. Work
8. NDI 8. Driving
9. NDI 9. Sleeping
10. NDI 10. Recreation
11. Overall spine health today (0 = worst, 10 = completely healthy)

### Still In Old Text Statement Layout (Needs New Images)

1. ODI 1. Pain intensity
2. ODI 2. Personal care (washing, dressing)
3. ODI 3. Lifting
4. ODI 4. Walking
5. ODI 5. Sitting
6. ODI 6. Standing
7. ODI 7. Sleeping
8. ODI 8. Sex life
9. ODI 9. Social life
10. ODI 10. Travelling
11. Fine hand tasks (buttoning, writing, picking up small objects)
12. Balance / gait

---

## Copy-Paste Prompt Template (Use For Each Question)

Copy this into ChatGPT and replace QUESTION_TEXT and OPTION_LIST:

```text
Create a clean medical questionnaire card-deck image set for mobile app UI.

Style requirements:
- Clinical, trustworthy, modern design
- White/light-blue cards, soft shadows, clear typography
- One option per card, centered headline + optional subtext
- 4:5 portrait composition per card
- No logos, no watermark
- Export each option as a separate PNG

Question screen title:
"QUESTION_TEXT"

Options (one card per option):
OPTION_LIST

Return:
1) One combined reference board showing all option cards
2) Individual transparent-background PNGs for each option card
```

---

## Exact Question Screens To Generate

### 1) ODI 1. Pain intensity

Question text:
- ODI 1. Pain intensity

Option list:
- 0. I have no pain at the moment.
- 1. The pain is very mild at the moment.
- 2. The pain is moderate at the moment.
- 3. The pain is fairly severe at the moment.
- 4. The pain is very severe at the moment.
- 5. The pain is the worst imaginable at the moment.

### 2) ODI 2. Personal care (washing, dressing)

Question text:
- ODI 2. Personal care (washing, dressing)

Option list:
- 0. I can look after myself normally without causing extra pain.
- 1. I can look after myself normally but it causes extra pain.
- 2. It is painful to look after myself and I am slow and careful.
- 3. I need some help but manage most of my personal care.
- 4. I need help every day in most aspects of self-care.
- 5. I do not get dressed, wash with difficulty, and stay in bed.

### 3) ODI 3. Lifting

Question text:
- ODI 3. Lifting

Option list:
- 0. I can lift heavy weights without extra pain.
- 1. I can lift heavy weights but it gives extra pain.
- 2. Pain prevents me lifting heavy weights off the floor, but I can manage if they are conveniently placed.
- 3. Pain prevents me lifting heavy weights, but I can manage light to medium weights if conveniently placed.
- 4. I can lift only very light weights.
- 5. I cannot lift or carry anything at all.

### 4) ODI 4. Walking

Question text:
- ODI 4. Walking

Option list:
- 0. Pain does not prevent me walking any distance.
- 1. Pain prevents me walking more than 1 mile (1.6 km).
- 2. Pain prevents me walking more than 0.5 mile (0.8 km).
- 3. Pain prevents me walking more than 0.25 mile (0.4 km).
- 4. I can only walk using a stick or crutches.
- 5. I am in bed most of the time and have to crawl to the toilet.

### 5) ODI 5. Sitting

Question text:
- ODI 5. Sitting

Option list:
- 0. I can sit in any chair as long as I like.
- 1. I can only sit in my favorite chair as long as I like.
- 2. Pain prevents me sitting more than 1 hour.
- 3. Pain prevents me sitting more than 30 minutes.
- 4. Pain prevents me sitting more than 10 minutes.
- 5. Pain prevents me from sitting at all.

### 6) ODI 6. Standing

Question text:
- ODI 6. Standing

Option list:
- 0. I can stand as long as I want without extra pain.
- 1. I can stand as long as I want but it gives extra pain.
- 2. Pain prevents me standing more than 1 hour.
- 3. Pain prevents me standing more than 30 minutes.
- 4. Pain prevents me standing more than 10 minutes.
- 5. Pain prevents me from standing at all.

### 7) ODI 7. Sleeping

Question text:
- ODI 7. Sleeping

Option list:
- 0. My sleep is never disturbed by pain.
- 1. My sleep is occasionally disturbed by pain.
- 2. Because of pain, I sleep less than 6 hours.
- 3. Because of pain, I sleep less than 4 hours.
- 4. Because of pain, I sleep less than 2 hours.
- 5. Pain prevents me from sleeping at all.

### 8) ODI 8. Sex life

Question text:
- ODI 8. Sex life

Option list:
- 0. My sex life is normal and causes no extra pain.
- 1. My sex life is normal but causes some extra pain.
- 2. My sex life is nearly normal but very painful.
- 3. My sex life is severely restricted by pain.
- 4. My sex life is nearly absent because of pain.
- 5. Pain prevents any sex life at all.

### 9) ODI 9. Social life

Question text:
- ODI 9. Social life

Option list:
- 0. My social life is normal and gives me no extra pain.
- 1. My social life is normal but increases pain.
- 2. Pain has no significant effect on my social life apart from limiting energetic interests.
- 3. Pain has restricted my social life and I do not go out as often.
- 4. Pain has restricted my social life to my home.
- 5. I have almost no social life because of pain.

### 10) ODI 10. Travelling

Question text:
- ODI 10. Travelling

Option list:
- 0. I can travel anywhere without extra pain.
- 1. I can travel anywhere but it gives extra pain.
- 2. Pain is bad but I manage journeys over 2 hours.
- 3. Pain restricts me to journeys under 1 hour.
- 4. Pain restricts me to short necessary journeys under 30 minutes.
- 5. Pain prevents me from travelling except for treatment.

### 11) Fine hand tasks (conditional myelopathy screen)

Question text:
- Fine hand tasks (buttoning, writing, picking up small objects)

Option list:
- Normal
- Slight clumsiness
- Noticeable difficulty
- Significant impairment

### 12) Balance / gait (conditional myelopathy screen)

Question text:
- Balance / gait

Option list:
- Normal
- Mild unsteadiness
- Frequent imbalance
- Needs support to walk

---

## Where To Drop Generated Assets

Recommended folder structure:
- public/illustrations/pain-map/odi-cards/
- public/illustrations/pain-map/myelopathy-cards/

Suggested naming:
- odi1-option-0.png ... odi1-option-5.png
- odi2-option-0.png ... odi2-option-5.png
- ...
- myelopathy-handtasks-option-1.png ... option-4.png
- myelopathy-balance-option-1.png ... option-4.png

---

## Next Integration Step (After Images Are Ready)

After you place generated images, update onetime-questionnaire-mock.tsx to add card renderer branches for:
- ODI 1..10
- myelopathyHandTasks
- myelopathyBalance

and remove their fallback old text-button rendering path.
