import fs from "../tauriFsProvider.js";

export function generateSid() {
  return Math.floor(Math.random() * 1000000000000000);
}

async function saveToFile(json, src) {
  await fs.writeFile(src, JSON.stringify(json, null, 2));
}

export async function moveBehaviorFromMembersToFamily(
  family,
  members,
  behaviorName
) {
  let behavior;
  let promises = [];

  const familyJSON = JSON.parse(family.originalJson);
  const familyProps = family.properties;

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const memberJSON = JSON.parse(member.originalJson);
    const memberProps = member.properties;
    const memberBehavior = memberJSON.behaviorTypes.find(
      (b) => b.name === behaviorName
    );
    if (!memberBehavior) {
      continue;
    }

    if (!behavior) {
      behavior = memberBehavior;
    }

    memberJSON.behaviorTypes = memberJSON.behaviorTypes.filter(
      (b) => b.name !== behaviorName
    );

    memberProps.behaviorTypes = memberProps.behaviorTypes.filter(
      (b) => b.name !== behaviorName
    );

    promises.push(saveToFile(memberJSON, member.src));
    member.originalJson = JSON.stringify(memberJSON);
  }

  const sid = generateSid();
  familyJSON.behaviorTypes.push({
    behaviorId: behavior.behaviorId,
    name: behavior.name,
    sid,
  });

  familyProps.behaviorTypes.push({
    behaviorId: behavior.behaviorId,
    name: behavior.name,
    sid,
  });

  promises.push(saveToFile(familyJSON, family.src));
  await Promise.all(promises);

  family.originalJson = JSON.stringify(familyJSON);
}

export async function moveBehaviorFromFamilyToMembers(
  family,
  members,
  behaviorName
) {
  let behavior;

  const familyJSON = JSON.parse(family.originalJson);
  const familyProps = family.properties;
  let promises = [];

  for (let i = 0; i < familyJSON.behaviorTypes.length; i++) {
    const familyBehavior = familyJSON.behaviorTypes[i];
    if (familyBehavior.name !== behaviorName) {
      continue;
    }

    if (!behavior) {
      behavior = familyBehavior;
    }
    familyJSON.behaviorTypes = familyJSON.behaviorTypes.filter(
      (b) => b.name !== behaviorName
    );
    familyProps.behaviorTypes = familyProps.behaviorTypes.filter(
      (b) => b.name !== behaviorName
    );
    break;
  }
  promises.push(saveToFile(familyJSON, family.src));

  family.originalJson = JSON.stringify(familyJSON);

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const memberJSON = JSON.parse(member.originalJson);
    const memberProps = member.properties;
    const sid = generateSid();
    memberJSON.behaviorTypes.push({
      behaviorId: behavior.behaviorId,
      name: behavior.name,
      sid,
    });

    memberProps.behaviorTypes.push({
      behaviorId: behavior.behaviorId,
      name: behavior.name,
      sid,
    });

    promises.push(saveToFile(memberJSON, member.src));

    member.originalJson = JSON.stringify(memberJSON);
  }

  await Promise.all(promises);
}
